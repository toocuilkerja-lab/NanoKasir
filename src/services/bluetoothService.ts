import { Order } from '../types';

// Bluetooth Service for thermal printer connection and commands
class BluetoothService {
  private device: any = null;
  private characteristic: any = null;

  async isBluetoothAvailable(): Promise<boolean> {
    return !!(navigator as any).bluetooth;
  }

  async getPairedPrinters(): Promise<{ id: string; name: string }[]> {
    const nav = navigator as any;
    if (!nav.bluetooth || !('getDevices' in nav.bluetooth)) {
      return [];
    }

    try {
      const devices = await nav.bluetooth.getDevices();
      return devices.map((device: any) => ({
        id: device.id,
        name: device.name || 'Unknown Printer'
      }));
    } catch (error) {
      console.error('Error getting paired printers:', error);
      return [];
    }
  }

  async connect(printerId?: string): Promise<any> {
    try {
      // If already connected, return characteristic
      if (this.characteristic && this.device?.gatt?.connected) {
        return this.characteristic;
      }

      const nav = navigator as any;
      if (!nav.bluetooth) {
        throw new Error("Bluetooth not supported in this browser");
      }

      let device: any;

      // Try to find device by ID if provided
      if (printerId && 'getDevices' in nav.bluetooth) {
        const devices = await nav.bluetooth.getDevices();
        device = devices.find((d: any) => d.id === printerId);
      }

      // If no device found or no ID provided, request new device
      if (!device) {
        device = await nav.bluetooth.requestDevice({
          filters: [
            { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
            { services: ['0000ff00-0000-1000-8000-00805f9b34fb'] },
            { services: ['49535343-fe7d-4ae5-8fa9-9fafd205e455'] }
          ],
          optionalServices: [
            '000018f0-0000-1000-8000-00805f9b34fb',
            '0000ff00-0000-1000-8000-00805f9b34fb',
            '49535343-fe7d-4ae5-8fa9-9fafd205e455',
            'e7e11101-4966-4a5a-a972-467144c414c8'
          ]
        });
      }

      this.device = device;
      const server = await this.device.gatt?.connect();
      
      // Common printer service UUIDs
      const commonPrinterServices = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        'e7e11101-4966-4a5a-a972-467144c414c8'
      ];

      const services = await server.getPrimaryServices();
      
      // Try to find a writable characteristic in any of the services
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            this.characteristic = char;
            
            if (this.device.id) {
              localStorage.setItem('printer_id', this.device.id);
            }

            this.device.addEventListener('gattserverdisconnected', () => {
              this.characteristic = null;
              console.log("Printer disconnected");
            });

            return this.characteristic;
          }
        }
      }

      throw new Error("No writable characteristic found");
    } catch (error) {
      console.error("Bluetooth connection failed", error);
      this.characteristic = null;
      throw error;
    }
  }

  async printTest(shopName: string) {
    const printerId = localStorage.getItem('printer_id') || undefined;
    const characteristic = await this.connect(printerId);
    if (!characteristic) return;

    const data = this.buildTestCommands(shopName);
    await this.sendData(characteristic, data);
  }

  async printReceipt(order: Order, shopName: string, shopAddress: string, payment?: { type: 'cash' | 'bank', amount: number, change: number }) {
    const printerId = localStorage.getItem('printer_id') || undefined;
    const characteristic = await this.connect(printerId);
    if (!characteristic) return;

    const data = this.buildReceiptCommands(order, shopName, shopAddress, payment);
    await this.sendData(characteristic, data);
  }

  private async sendData(characteristic: any, data: Uint8Array) {
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValueWithResponse(chunk);
      }
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private buildTestCommands(shopName: string): Uint8Array {
    const data: number[] = [];
    const ESC = 0x1B;
    const LF = 0x0A;

    data.push(ESC, 0x40); // Initialize
    data.push(ESC, 0x61, 1); // Center
    data.push(...this.encodeText("TEST PRINT\n"));
    data.push(...this.encodeText(`${shopName}\n`));
    data.push(...this.encodeText("--------------------------------\n"));
    data.push(...this.encodeText("Printer Berhasil Terhubung!\n"));
    data.push(...this.encodeText("Siap digunakan untuk transaksi.\n"));
    data.push(...this.encodeText("--------------------------------\n"));
    data.push(LF, LF, LF, LF);

    return new Uint8Array(data);
  }

  private buildReceiptCommands(order: Order, shopName: string, shopAddress: string, payment?: any): Uint8Array {
    const data: number[] = [];
    const ESC = 0x1B;
    const GS = 0x1D;
    const LF = 0x0A;

    data.push(ESC, 0x40); // Initialize
    data.push(ESC, 0x61, 1); // Center
    
    // Shop Name (Bold)
    data.push(ESC, 0x45, 1);
    data.push(...this.encodeText(`${shopName.toUpperCase()}\n`));
    data.push(ESC, 0x45, 0);
    
    data.push(...this.encodeText(`${shopAddress}\n`));
    data.push(...this.encodeText("--------------------------------\n"));

    data.push(ESC, 0x61, 0); // Left
    data.push(...this.encodeText(`Antrian: ${order.queueNumber}\n`));
    data.push(...this.encodeText(`Pelanggan: ${order.customerName}\n`));
    data.push(...this.encodeText(`Meja: ${order.tableNumber}\n`));
    
    const formattedDate = new Date(order.timestamp).toLocaleString('id-ID');
    data.push(...this.encodeText(`Tgl: ${formattedDate}\n`));
    data.push(...this.encodeText("--------------------------------\n"));

    order.items.forEach(item => {
      const name = item.name.substring(0, 20);
      const qty = `x${item.quantity}`;
      const price = (item.price * item.quantity).toLocaleString('id-ID');
      
      const line = `${name} ${qty}`;
      const spaces = 32 - line.length - price.length;
      const padding = ' '.repeat(Math.max(1, spaces));
      
      data.push(...this.encodeText(`${line}${padding}${price}\n`));
      if (item.note) {
        data.push(...this.encodeText(` - ${item.note}\n`));
      }
    });

    data.push(...this.encodeText("--------------------------------\n"));

    // Total
    data.push(ESC, 0x61, 2); // Right
    data.push(ESC, 0x45, 1);
    data.push(...this.encodeText(`TOTAL: Rp ${order.totalPrice.toLocaleString('id-ID')}\n`));
    data.push(ESC, 0x45, 0);

    if (payment) {
      data.push(...this.encodeText(`BAYAR: Rp ${payment.amount.toLocaleString('id-ID')}\n`));
      data.push(...this.encodeText(`KEMBALI: Rp ${payment.change.toLocaleString('id-ID')}\n`));
    }

    data.push(LF, LF);
    data.push(ESC, 0x61, 1); // Center
    data.push(...this.encodeText("Terima Kasih!\n"));
    data.push(LF, LF, LF, LF);

    return new Uint8Array(data);
  }

  private encodeText(text: string): number[] {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(text));
  }
}

export const bluetoothService = new BluetoothService();
