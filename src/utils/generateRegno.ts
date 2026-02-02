import db from '../db';

export async function generateRegNo(species: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  const speciesPrefix = species.toUpperCase().slice(0, 4); 
  
  const count = await db('animals')
    .where('species', species)
    .count('* as total');
  
  const nextNumber = (parseInt(count[0]?.total as string) || 0) + 1;
  
  return `${speciesPrefix}/${nextNumber}/${year}`;
}