export const BANKS = [
  { code: "MB", name: "MB Bank" },
  { code: "VCB", name: "Vietcombank" },
  { code: "ACB", name: "ACB" },
  { code: "TCB", name: "Techcombank" },
  { code: "BIDV", name: "BIDV" },
  { code: "VPB", name: "VPBank" },
  { code: "TPB", name: "TPBank" },
  { code: "ICB", name: "VietinBank" },
  { code: "STB", name: "Sacombank" },
  { code: "MSB", name: "MSB" },
  { code: "OCB", name: "OCB" },
  { code: "HDB", name: "HDBank" },
  { code: "VIB", name: "VIB" },
  { code: "SHB", name: "SHB" },
] as const;

export function bankName(code: string) {
  return BANKS.find((bank) => bank.code === code)?.name ?? code;
}
