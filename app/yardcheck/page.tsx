import { redirect } from 'next/navigation';

export default async function YardCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ inspect?: string }>;
}) {
  const { inspect } = await searchParams;
  redirect(inspect ? `/yardcheck/summary?inspect=${inspect}` : '/yardcheck/summary');
}
