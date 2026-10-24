// Boards found by the 2026-10-24 trial; each was checked by brute force to have exactly one solution.
export const parseRegions = (digits) => [...digits].map(Number);
export const EASY_6 = { n: 6, regions: parseRegions('355522335222555522555511554411444401'), mines: [0, 9, 13, 23, 26, 34], hardest: 1 };
export const MEDIUM_6 = { n: 6, regions: parseRegions('225551220051220555444555444555444535'), mines: [5, 8, 12, 21, 25, 34], hardest: 2 };
export const HARD_6 = { n: 6, regions: parseRegions('033555033555335555555554225114222214'), mines: [2, 6, 15, 23, 25, 34], hardest: 3 };
export const AMBIGUOUS_4 = { n: 4, regions: parseRegions('0000111122223333') }; // every row is its own color: 2 solutions
