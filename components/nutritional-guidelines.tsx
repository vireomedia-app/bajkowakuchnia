'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

interface NutritionalGuidelinesProps {
  guidelines: string;
}

export function NutritionalGuidelines({ guidelines }: NutritionalGuidelinesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!guidelines) return null;
  
  const PREVIEW_LENGTH = 100; // Około 100 znaków
  const shouldTruncate = guidelines.length > PREVIEW_LENGTH;
  
  const previewText = shouldTruncate 
    ? guidelines.substring(0, PREVIEW_LENGTH) + '...' 
    : guidelines;
  
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
          <Info className="w-5 h-5" />
          Wytyczne żywieniowe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-blue-800">
          <p className="whitespace-pre-wrap">
            {isExpanded ? guidelines : previewText}
          </p>
          
          {shouldTruncate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-700 hover:text-blue-900 hover:bg-blue-100 mt-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Zwiń
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Rozwiń
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
