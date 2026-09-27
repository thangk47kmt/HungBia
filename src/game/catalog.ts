export type BeerKind = "can" | "bottle";

export type BeerDef = {
  id: string;
  name: string;
  kind: BeerKind;
  points: number;
  blurb: string;
  body: string;
  label: string;
  cap: string;
  mark: string;
};

export type StaffDef = {
  id: string;
  name: string;
  role: string;
  line: string;
  portrait: string;
};

export type LevelDef = {
  id: number;
  name: string;
  spawn: number;
  speed: number;
  every: number;
  caption: string;
  image: string;
};

export const BAR_BG = "/art/bg.jpg";

export const BEERS: BeerDef[] = [
  {
    id: "suong-mai",
    name: "Sương Mai",
    kind: "can",
    points: 10,
    blurb: "Lager vàng, lon lạnh",
    body: "#e2b23a",
    label: "#f6efe4",
    cap: "#c4522a",
    mark: "SM",
  },
  {
    id: "lua-moi",
    name: "Lúa Mới",
    kind: "bottle",
    points: 12,
    blurb: "Lúa mì, chai thuỷ tinh",
    body: "#f0d59a",
    label: "#fff8ee",
    cap: "#d7a441",
    mark: "LM",
  },
  {
    id: "dem-den",
    name: "Đêm Đen",
    kind: "can",
    points: 14,
    blurb: "Stout đậm, lon đen",
    body: "#2c241e",
    label: "#e7d3b0",
    cap: "#8a6a3b",
    mark: "ĐĐ",
  },
  {
    id: "song-ca",
    name: "Sông Cả",
    kind: "bottle",
    points: 16,
    blurb: "IPA, chai xanh",
    body: "#6e8f5e",
    label: "#f3ecdf",
    cap: "#c9a227",
    mark: "SC",
  },
];

export const STAFF: StaffDef[] = [
  {
    id: "lan",
    name: "Lan",
    role: "Trưởng quầy",
    line: "Sáu năm sau quầy gỗ.",
    portrait: "/art/staff-lan.jpg",
  },
  {
    id: "khoa",
    name: "Khoa",
    role: "Ca tối",
    line: "Rót đều, không vội.",
    portrait: "/art/staff-khoa.jpg",
  },
  {
    id: "my",
    name: "My",
    role: "Bia thủ công",
    line: "Nhớ từng dòng bia trong quán.",
    portrait: "/art/staff-my.jpg",
  },
];

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Mở ca",
    spawn: 20,
    speed: 190,
    every: 0.78,
    caption: "Lau quầy, bật đèn, ca bắt đầu.",
    image: "/art/level-1.jpg",
  },
  {
    id: 2,
    name: "Giờ vàng",
    spawn: 26,
    speed: 245,
    every: 0.7,
    caption: "Mẻ bia đầu trong giờ vàng.",
    image: "/art/level-2.jpg",
  },
  {
    id: 3,
    name: "Đông bàn",
    spawn: 34,
    speed: 300,
    every: 0.6,
    caption: "Khay đầy, quán đông bàn.",
    image: "/art/level-3.jpg",
  },
  {
    id: 4,
    name: "Happy hour",
    spawn: 42,
    speed: 350,
    every: 0.52,
    caption: "Cụng ly sau đợt khách.",
    image: "/art/level-4.jpg",
  },
  {
    id: 5,
    name: "Cuối tuần",
    spawn: 52,
    speed: 410,
    every: 0.46,
    caption: "Xếp lại kệ cuối tuần.",
    image: "/art/level-5.jpg",
  },
  {
    id: 6,
    name: "Last call",
    spawn: 62,
    speed: 470,
    every: 0.4,
    caption: "Khoá cửa, hết ca đêm.",
    image: "/art/level-6.jpg",
  },
];

export function beerById(id: string): BeerDef {
  return BEERS.find((b) => b.id === id) ?? BEERS[0]!;
}

export function staffById(id: string): StaffDef {
  return STAFF.find((s) => s.id === id) ?? STAFF[0]!;
}

export function levelById(id: number): LevelDef {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0]!;
}

export function levelTarget(level: LevelDef): number {
  return Math.max(1, level.spawn - 2);
}
