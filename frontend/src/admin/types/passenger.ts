import { IdProofType, DisabilityType, ConcessionType, BerthType } from '../constants/enums';

export interface Passenger {
  passengerId: number;
  userId: number;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  idProofType: IdProofType;
  idProofReference: string;
  disabilityType: DisabilityType;
  concessionType: ConcessionType;
  berthPreference: BerthType;
}
