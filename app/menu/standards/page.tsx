import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { prisma } from '@/lib/db';
import { StandardsPageClient } from '@/components/standards-page-client';

export const dynamic = "force-dynamic";

async function getStandards() {
  try {
    const standards = await prisma.nutritionalStandards.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    return standards;
  } catch (error) {
    console.error('Error fetching standards:', error);
    return [];
  }
}

export default async function StandardsPage() {
  const standards = await getStandards();
  const defaultStandard = standards[0];

  return <StandardsPageClient initialStandard={defaultStandard} />;
}
