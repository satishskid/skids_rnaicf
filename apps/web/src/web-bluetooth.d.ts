/** Web Bluetooth API type stubs for TypeScript */
interface BluetoothDevice {
  id: string
  name?: string
  gatt?: BluetoothRemoteGATTServer
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic {
  value: DataView | null
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  readValue(): Promise<DataView>
  writeValue(value: BufferSource): Promise<void>
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface Navigator {
  bluetooth?: {
    requestDevice(options: {
      filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>
      optionalServices?: string[]
      acceptAllDevices?: boolean
    }): Promise<BluetoothDevice>
    getAvailability(): Promise<boolean>
  }
}
