import { STYLE_PHOTOS } from "./catalog";

type Gym = {
  id: string;
  name: string;
  gymType: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  photoUrl: string;
  description: string;
  amenities: string[];
  hours: string;
  phone: string;
};

type Row = [string, string, string, string, string, number, number];

const ROWS: Row[] = [
  ["ie-laf-pkwy", "LA Fitness Temecula Parkway", "fitness", "26420 Ynez Rd", "Temecula", 33.4806, -117.1377],
  ["ie-24hr-win", "24 Hour Fitness Temecula", "fitness", "40744 Winchester Rd", "Temecula", 33.5215, -117.154],
  ["ie-crunch-tem", "Crunch Fitness Temecula", "fitness", "27540 Ynez Rd", "Temecula", 33.503, -117.122],
  ["ie-ufc-tem", "UFC Gym Temecula", "mma", "40780 Winchester Rd", "Temecula", 33.5265, -117.1522],
  ["ie-chuze-tem", "Chuze Fitness Temecula", "fitness", "40620 Winchester Rd", "Temecula", 33.5188, -117.161],
  ["ie-otf-tem", "Orangetheory Fitness Temecula", "fitness", "39540 Winchester Rd", "Temecula", 33.5045, -117.1488],
  ["ie-f45-tem", "F45 Training Temecula", "fitness", "27524 Jefferson Ave", "Temecula", 33.5122, -117.1565],
  ["ie-cf-tem", "CrossFit Temecula", "strength", "41755 Enterprise Cir N", "Temecula", 33.498, -117.132],
  ["ie-title-tem", "Title Boxing Club Temecula", "boxing", "40420 Winchester Rd", "Temecula", 33.5078, -117.151],
  ["ie-9round-tem", "9Round Temecula", "boxing", "27645 Jefferson Ave", "Temecula", 33.4995, -117.144],
  ["ie-gb-tem", "Gracie Barra Temecula", "bjj", "27475 Ynez Rd", "Temecula", 33.509, -117.1395],
  ["ie-nl-mma", "Next Level MMA Temecula", "mma", "41707 Winchester Rd", "Temecula", 33.5155, -117.147],
  ["ie-impact-bjj", "Impact Jiu-Jitsu Temecula", "bjj", "43380 Business Park Dr", "Temecula", 33.4888, -117.126],
  ["ie-yoga6", "Yoga Six Temecula", "yoga", "40448 Winchester Rd", "Temecula", 33.5022, -117.1577],
  ["ie-corepower", "CorePower Yoga Temecula", "yoga", "40705 Winchester Rd", "Temecula", 33.52, -117.149],
  ["ie-burn-tem", "Burn Boot Camp Temecula", "fitness", "27640 Ynez Rd", "Temecula", 33.511, -117.1633],
  ["ie-any-tem", "Anytime Fitness Temecula", "fitness", "28910 Pujol St", "Temecula", 33.486, -117.1518],
  ["ie-mayweather", "Mayweather Boxing + Fitness", "boxing", "40760 Winchester Rd", "Temecula", 33.5233, -117.1588],
  ["ie-rumble", "Rumble Boxing Temecula", "boxing", "40400 Winchester Rd", "Temecula", 33.5088, -117.1411],
  ["ie-white-dragon", "White Dragon Martial Arts", "karate", "28900 Margarita Rd", "Temecula", 33.5241, -117.1499],
  ["ie-usd", "Ultimate Self Defence Studios", "mma", "29751 Rancho California Rd", "Temecula", 33.5202, -117.1603],
  ["ie-hana", "Hana Taekwondo", "karate", "31725 Temecula Pkwy", "Temecula", 33.4784, -117.1039],
  ["ie-giordano", "Giordano's Martial Arts", "karate", "31250 Temecula Pkwy", "Temecula", 33.4841, -117.0817],
  ["ie-yama", "Yamashita Martial Arts", "karate", "31145 Temecula Pkwy", "Temecula", 33.4824, -117.0873],
  ["ie-vital", "Vital Climbing Gym", "fitness", "25180 Madison Ave", "Murrieta", 33.5611, -117.1364],
  ["ie-legacy", "Legacy Gym", "strength", "25125 Madison Ave", "Murrieta", 33.5581, -117.2078],
  ["ie-laf-mur", "LA Fitness Murrieta", "fitness", "25125 Madison Ave", "Murrieta", 33.5538, -117.204],
  ["ie-24hr-mur", "24 Hour Fitness Murrieta", "fitness", "39400 Murrieta Hot Springs Rd", "Murrieta", 33.568, -117.188],
  ["ie-ufc-mur", "UFC Gym Murrieta", "mma", "25180 Hancock Ave", "Murrieta", 33.5585, -117.1965],
  ["ie-chuze-mur", "Chuze Fitness Murrieta", "fitness", "39896 Murrieta Hot Springs Rd", "Murrieta", 33.5622, -117.2108],
  ["ie-otf-mur", "Orangetheory Fitness Murrieta", "fitness", "40440 Murrieta Hot Springs Rd", "Murrieta", 33.549, -117.1992],
  ["ie-gb-mur", "Gracie Barra Murrieta", "bjj", "25170 Hancock Ave", "Murrieta", 33.555, -117.191],
  ["ie-box-mur", "Murrieta Boxing Academy", "boxing", "25925 Jefferson Ave", "Murrieta", 33.5604, -117.2022],
  ["ie-alliance-mur", "Alliance MMA Murrieta", "mma", "24630 Madison Ave", "Murrieta", 33.5466, -117.1855],
  ["ie-pf-mur", "Planet Fitness Murrieta", "fitness", "39812 Murrieta Hot Springs Rd", "Murrieta", 33.571, -117.1958],
  ["ie-sky-ma", "Sky Martial Arts", "karate", "29970 Technology Dr", "Murrieta", 33.5556, -117.1748],
  ["ie-any-wild", "Anytime Fitness Wildomar", "fitness", "32315 Clinton Keith Rd", "Wildomar", 33.5988, -117.2805],
  ["ie-wild-karate", "Wildomar Karate", "karate", "23811 Clinton Keith Rd", "Wildomar", 33.6033, -117.273],
  ["ie-chuze-men", "Chuze Fitness Menifee", "fitness", "30125 Antelope Rd", "Menifee", 33.6785, -117.1852],
  ["ie-pf-men", "Planet Fitness Menifee", "fitness", "29950 Haun Rd", "Menifee", 33.683, -117.172],
  ["ie-otf-men", "Orangetheory Fitness Menifee", "fitness", "29875 Haun Rd", "Menifee", 33.6712, -117.1688],
  ["ie-ma-men", "Menifee Martial Arts", "karate", "26920 Cherry Hills Blvd", "Menifee", 33.6755, -117.179],
  ["ie-cf-men", "CrossFit Menifee", "strength", "30251 Antelope Rd", "Menifee", 33.688, -117.1815],
  ["ie-pf-le", "Planet Fitness Lake Elsinore", "fitness", "31580 Casino Dr", "Lake Elsinore", 33.6682, -117.3275],
  ["ie-inshape-le", "In-Shape Lake Elsinore", "fitness", "18170 Collier Ave", "Lake Elsinore", 33.674, -117.321],
  ["ie-box-le", "Elsinore Boxing Club", "boxing", "31740 Casino Dr", "Lake Elsinore", 33.6615, -117.3308],
  ["ie-mma-le", "Lake Elsinore MMA", "mma", "17620 Collier Ave", "Lake Elsinore", 33.6699, -117.3155],
  ["ie-fv-fit", "French Valley Fitness", "fitness", "31431 Benton Rd", "Winchester", 33.5195, -117.098],
  ["ie-win-str", "Winchester Strength Co", "strength", "30650 Borel Rd", "Winchester", 33.5068, -117.0844],
  ["ie-any-fall", "Anytime Fitness Fallbrook", "fitness", "1101 S Main Ave", "Fallbrook", 33.3762, -117.251],
  ["ie-box-fall", "Fallbrook Boxing Gym", "boxing", "120 W College St", "Fallbrook", 33.3805, -117.2466],
  ["ie-bjj-fall", "Fallbrook Jiu-Jitsu", "bjj", "593 E Alvarado St", "Fallbrook", 33.3728, -117.2388],
  ["ie-ph-hemet", "Powerhouse Gym Hemet", "strength", "2391 W Florida Ave", "Hemet", 33.7709, -116.9562],
  ["ie-24hr-hemet", "24 Hour Fitness Hemet", "fitness", "2200 W Florida Ave", "Hemet", 33.747, -116.973],
  ["ie-box-hemet", "Hemet Boxing Club", "boxing", "130 N State St", "Hemet", 33.7515, -116.9688],
  ["ie-perris", "Perris Gym", "fitness", "255 E 4th St", "Perris", 33.787, -117.2273],
  ["ie-pf-perris", "Planet Fitness Perris", "fitness", "1688 N Perris Blvd", "Perris", 33.7822, -117.2288],
  ["ie-otf-fv", "Orangetheory French Valley", "fitness", "30640 Haun Rd", "Winchester", 33.5288, -117.1022],
  ["ie-snap-tem", "Snap Fitness Temecula", "fitness", "32170 Temecula Pkwy", "Temecula", 33.4772, -117.0995],
  ["ie-cyclebar", "CycleBar Temecula", "fitness", "40420 Winchester Rd", "Temecula", 33.5066, -117.1533],
];

export const SOCAL_EXTRA_GYMS: Gym[] = ROWS.map(([id, name, gymType, address, city, lat, lng]) => ({
  id,
  name,
  gymType,
  address,
  city,
  lat,
  lng,
  photoUrl: STYLE_PHOTOS[gymType] ?? STYLE_PHOTOS.fitness,
  description: `${name} in ${city}. Bags, mats, or iron — book a Mittwork trainer here or walk in.`,
  amenities: ["Parking", "Lockers", "Showers"],
  hours: "Hours vary — check the front desk",
  phone: "(951) 555-0100",
}));
