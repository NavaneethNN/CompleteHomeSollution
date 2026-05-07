// Popular Australian suburbs by state for dropdown suggestions
export interface Suburb {
  name: string;
  state: string;
  postcode: string;
}

// Top suburbs by state - common delivery areas
export const AUSTRALIAN_SUBURBS: Suburb[] = [
  // NSW - Major metro areas
  { name: "Sydney", state: "NSW", postcode: "2000" },
  { name: "Parramatta", state: "NSW", postcode: "2150" },
  { name: "Chatswood", state: "NSW", postcode: "2067" },
  { name: "Bondi", state: "NSW", postcode: "2026" },
  { name: "Manly", state: "NSW", postcode: "2095" },
  { name: "North Sydney", state: "NSW", postcode: "2060" },
  { name: "Newcastle", state: "NSW", postcode: "2300" },
  { name: "Wollongong", state: "NSW", postcode: "2500" },
  { name: "Penrith", state: "NSW", postcode: "2750" },
  { name: "Blacktown", state: "NSW", postcode: "2148" },
  { name: "Liverpool", state: "NSW", postcode: "2170" },
  { name: "Campbelltown", state: "NSW", postcode: "2560" },
  { name: "Hornsby", state: "NSW", postcode: "2077" },
  { name: "Gosford", state: "NSW", postcode: "2250" },
  { name: "Byron Bay", state: "NSW", postcode: "2481" },
  { name: "Port Macquarie", state: "NSW", postcode: "2444" },
  { name: "Coffs Harbour", state: "NSW", postcode: "2450" },

  // VIC - Major metro areas
  { name: "Melbourne", state: "VIC", postcode: "3000" },
  { name: "Richmond", state: "VIC", postcode: "3121" },
  { name: "St Kilda", state: "VIC", postcode: "3182" },
  { name: "Footscray", state: "VIC", postcode: "3011" },
  { name: "Brunswick", state: "VIC", postcode: "3056" },
  { name: "Carlton", state: "VIC", postcode: "3053" },
  { name: "South Yarra", state: "VIC", postcode: "3141" },
  { name: "Hawthorn", state: "VIC", postcode: "3122" },
  { name: "Camberwell", state: "VIC", postcode: "3124" },
  { name: "Box Hill", state: "VIC", postcode: "3128" },
  { name: "Doncaster", state: "VIC", postcode: "3108" },
  { name: "Ringwood", state: "VIC", postcode: "3134" },
  { name: "Glen Waverley", state: "VIC", postcode: "3150" },
  { name: "Frankston", state: "VIC", postcode: "3199" },
  { name: "Geelong", state: "VIC", postcode: "3220" },
  { name: "Ballarat", state: "VIC", postcode: "3350" },
  { name: "Bendigo", state: "VIC", postcode: "3550" },

  // QLD - Major metro areas
  { name: "Brisbane", state: "QLD", postcode: "4000" },
  { name: "South Brisbane", state: "QLD", postcode: "4101" },
  { name: "Fortitude Valley", state: "QLD", postcode: "4006" },
  { name: "New Farm", state: "QLD", postcode: "4005" },
  { name: "Paddington", state: "QLD", postcode: "4064" },
  { name: "Toowong", state: "QLD", postcode: "4066" },
  { name: "Indooroopilly", state: "QLD", postcode: "4068" },
  { name: "Chermside", state: "QLD", postcode: "4032" },
  { name: "Carindale", state: "QLD", postcode: "4152" },
  { name: "Mount Gravatt", state: "QLD", postcode: "4122" },
  { name: "Sunnybank", state: "QLD", postcode: "4109" },
  { name: "Gold Coast", state: "QLD", postcode: "4217" },
  { name: "Surfers Paradise", state: "QLD", postcode: "4217" },
  { name: "Broadbeach", state: "QLD", postcode: "4218" },
  { name: "Burleigh Heads", state: "QLD", postcode: "4220" },
  { name: "Cairns", state: "QLD", postcode: "4870" },
  { name: "Townsville", state: "QLD", postcode: "4810" },

  // WA - Major metro areas
  { name: "Perth", state: "WA", postcode: "6000" },
  { name: "Fremantle", state: "WA", postcode: "6160" },
  { name: "Subiaco", state: "WA", postcode: "6008" },
  { name: "Claremont", state: "WA", postcode: "6010" },
  { name: "Nedlands", state: "WA", postcode: "6009" },
  { name: "Cottesloe", state: "WA", postcode: "6011" },
  { name: "Scarborough", state: "WA", postcode: "6019" },
  { name: "Joondalup", state: "WA", postcode: "6027" },
  { name: "Cannington", state: "WA", postcode: "6107" },
  { name: "Bentley", state: "WA", postcode: "6102" },
  { name: "Victoria Park", state: "WA", postcode: "6100" },

  // SA - Major metro areas
  { name: "Adelaide", state: "SA", postcode: "5000" },
  { name: "North Adelaide", state: "SA", postcode: "5006" },
  { name: "Norwood", state: "SA", postcode: "5067" },
  { name: "Unley", state: "SA", postcode: "5061" },
  { name: "Prospect", state: "SA", postcode: "5082" },
  { name: "Burnside", state: "SA", postcode: "5066" },
  { name: "Glenelg", state: "SA", postcode: "5045" },
  { name: "Brighton", state: "SA", postcode: "5048" },
  { name: "Henley Beach", state: "SA", postcode: "5022" },
  { name: "Port Adelaide", state: "SA", postcode: "5015" },
  { name: "Tea Tree Gully", state: "SA", postcode: "5091" },
  { name: "Modbury", state: "SA", postcode: "5092" },

  // ACT
  { name: "Canberra", state: "ACT", postcode: "2601" },
  { name: "Belconnen", state: "ACT", postcode: "2617" },
  { name: "Woden", state: "ACT", postcode: "2606" },
  { name: "Tuggeranong", state: "ACT", postcode: "2900" },
  { name: "Gungahlin", state: "ACT", postcode: "2912" },
  { name: "Manuka", state: "ACT", postcode: "2603" },
  { name: "Kingston", state: "ACT", postcode: "2604" },

  // NT
  { name: "Darwin", state: "NT", postcode: "0800" },
  { name: "Alice Springs", state: "NT", postcode: "0870" },
  { name: "Palmerston", state: "NT", postcode: "0830" },
  { name: "Katherine", state: "NT", postcode: "0850" },
  { name: "Tennant Creek", state: "NT", postcode: "0860" },

  // TAS
  { name: "Hobart", state: "TAS", postcode: "7000" },
  { name: "Launceston", state: "TAS", postcode: "7250" },
  { name: "Devonport", state: "TAS", postcode: "7310" },
  { name: "Burnie", state: "TAS", postcode: "7320" },
  { name: "Sandy Bay", state: "TAS", postcode: "7005" },
  { name: "New Town", state: "TAS", postcode: "7008" },
  { name: "Kingston", state: "TAS", postcode: "7050" },
];

// Get suburbs by state
export function getSuburbsByState(state: string): Suburb[] {
  return AUSTRALIAN_SUBURBS.filter((suburb) => suburb.state === state);
}

// Get all suburbs sorted alphabetically
export function getAllSuburbs(): Suburb[] {
  return [...AUSTRALIAN_SUBURBS].sort((a, b) => a.name.localeCompare(b.name));
}
