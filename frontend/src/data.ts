import { Device, Client } from './types';

export const mockDevices: Device[] = [
{
  id: 'DEV-001',
  clientId: 'CLI-001',
  clientName: 'Transportes del Norte',
  deviceName: 'Camión Volvo TX-100 (ABC-123)',
  imei: '864321049583721',
  model: 'Teltonika FMB120',
  registrationDate: '2023-01-15',
  expirationDate: '2024-12-31',
  status: 'active'
},
{
  id: 'DEV-002',
  clientId: 'CLI-001',
  clientName: 'Transportes del Norte',
  deviceName: 'Camión Scania R450 (XYZ-987)',
  imei: '864321049583722',
  model: 'Teltonika FMB120',
  registrationDate: '2023-02-20',
  expirationDate: '2024-05-10',
  status: 'expiring'
},
{
  id: 'DEV-003',
  clientId: 'CLI-002',
  clientName: 'Logística Express S.A.',
  deviceName: 'Furgoneta Sprinter (DEF-456)',
  imei: '358912048573921',
  model: 'Concox GT06N',
  registrationDate: '2022-11-05',
  expirationDate: '2024-05-01',
  status: 'expired'
},
{
  id: 'DEV-004',
  clientId: 'CLI-003',
  clientName: 'Distribuidora Central',
  deviceName: 'Moto Honda Cargo (MTO-001)',
  imei: '990011223344556',
  model: 'SinoTrack ST-901',
  registrationDate: '2023-06-10',
  expirationDate: '2025-06-10',
  status: 'active'
},
{
  id: 'DEV-005',
  clientId: 'CLI-003',
  clientName: 'Distribuidora Central',
  deviceName: 'Moto Yamaha (MTO-002)',
  imei: '990011223344557',
  model: 'SinoTrack ST-901',
  registrationDate: '2023-06-12',
  expirationDate: '2024-05-08',
  status: 'expiring'
},
{
  id: 'DEV-006',
  clientId: 'CLI-004',
  clientName: 'Constructora Alfa',
  deviceName: 'Excavadora CAT 320',
  imei: '861234567890123',
  model: 'Ruptela FM-Eco4',
  registrationDate: '2021-08-22',
  expirationDate: '2024-08-22',
  status: 'active'
},
{
  id: 'DEV-007',
  clientId: 'CLI-004',
  clientName: 'Constructora Alfa',
  deviceName: 'Volquete Mercedes (VOL-01)',
  imei: '861234567890124',
  model: 'Ruptela FM-Eco4',
  registrationDate: '2021-08-22',
  expirationDate: '2023-12-31',
  status: 'deactivated'
},
{
  id: 'DEV-008',
  clientId: 'CLI-005',
  clientName: 'Seguridad Privada Omega',
  deviceName: 'Patrulla Ford Ranger (PAT-10)',
  imei: '353456789012345',
  model: 'Coban GPS-303',
  registrationDate: '2024-01-05',
  expirationDate: '2025-01-05',
  status: 'active'
}];


export const mockClients: Client[] = [
{
  id: 'CLI-001',
  name: 'Transportes del Norte',
  email: 'contacto@transnorte.com',
  phone: '+52 55 1234 5678',
  status: 'active',
  devices: mockDevices.filter((d) => d.clientId === 'CLI-001')
},
{
  id: 'CLI-002',
  name: 'Logística Express S.A.',
  email: 'operaciones@logexpress.com',
  phone: '+52 81 9876 5432',
  status: 'active',
  devices: mockDevices.filter((d) => d.clientId === 'CLI-002')
},
{
  id: 'CLI-003',
  name: 'Distribuidora Central',
  email: 'admin@distcentral.com',
  phone: '+52 33 4567 8901',
  status: 'active',
  devices: mockDevices.filter((d) => d.clientId === 'CLI-003')
},
{
  id: 'CLI-004',
  name: 'Constructora Alfa',
  email: 'flota@calfa.com',
  phone: '+52 55 2233 4455',
  status: 'inactive',
  devices: mockDevices.filter((d) => d.clientId === 'CLI-004')
},
{
  id: 'CLI-005',
  name: 'Seguridad Privada Omega',
  email: 'control@omega.com',
  phone: '+52 55 6677 8899',
  status: 'active',
  devices: mockDevices.filter((d) => d.clientId === 'CLI-005')
}];