import mongoose from "mongoose";

/**
 * SNAPSHOT GAJI TERAKHIR PER USER
 * - BUKAN payroll
 * - BUKAN histori
 * - TIDAK dihitung ulang
 * - Semua angka adalah hasil keputusan terakhir admin
 */

const SalarySchema = new mongoose.Schema(
  {
    // 1 user = 1 snapshot gaji terakhir
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      unique: true,
    },

    // Informasi rekening (sekadar catatan)
    bank_account: {
      bank_name: String,
      account_number: String,
      account_holder_name: String,
    },

    // Gaji pokok
    base_salary: {
      type: mongoose.Types.Decimal128,
      required: true,
    },

    currency: {
      type: String,
      default: "IDR",
    },

    // TUNJANGAN (detail statis)
    allowances: [
      {
        name: {
          type: String,
          required: true,
        },
        amount: {
          type: mongoose.Types.Decimal128,
          required: true,
        },
      },
    ],

    // POTONGAN (BPJS, Asuransi, dll SEMUA DI SINI)
    deductions: [
      {
        name: {
          type: String,
          required: true, // contoh: "BPJS Kesehatan", "BPJS JHT", "Asuransi Allianz"
        },
        amount: {
          type: mongoose.Types.Decimal128,
          required: true,
        },
        category: {
          type: String,
          enum: ["bpjs", "insurance", "other"],
          default: "other",
        },
      },
    ],

    // TOTAL HASIL (WAJIB UNTUK SNAPSHOT)
    total_allowance: {
      type: mongoose.Types.Decimal128,
      required: true,
    },

    total_deduction: {
      type: mongoose.Types.Decimal128,
      required: true,
    },

    // UANG BERSIH FINAL (YANG DITERIMA KARYAWAN)
    take_home_pay: {
      type: mongoose.Types.Decimal128,
      required: true,
    },

    // Status snapshot
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },

    // Catatan bebas (manual)
    note: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Salary", SalarySchema);
