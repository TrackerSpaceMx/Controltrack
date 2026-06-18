export type DeviceStatus = 'active' | 'expiring' | 'expired' | 'deactivated';

export interface Device {
  id: string;
  clientId: string;
  clientName: string;
  deviceName: string;
  imei: string;
  model: string;
  registrationDate: string;
  expirationDate: string;
  status: DeviceStatus;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  devices: Device[];
}