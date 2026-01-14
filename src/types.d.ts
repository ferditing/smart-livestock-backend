export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: 'farmer'|'vet'|'agrovet'|'admin';
}
