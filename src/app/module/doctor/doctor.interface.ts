import { DoctorVerificationStatus } from "../../../generated/prisma/enums";

export interface IApplyAsDoctorPayload {
 user: {
    name: string;
    email: string;
  };
  doctor: {
    specialization: string;
    licenseNumber: string;
    qualifications: string;
    experienceYears: number;
    address?: string | null;
    bio?: string | null;
    consultationFee?: number;
    contactNumber?: string;
  };
}

export interface IVerifyDoctorEmailPayload {
  email: string;
  otp: string;
}
export interface IApproveDoctorPayload {
  doctorId: string;
  verificationStatus: DoctorVerificationStatus;
  rejectionReason?: string
}

export interface IUpdateDoctorProfilePayload {
    address?: string;
    bio?: string;
    consultationFee?: number;
    contactNumber?: string;
}