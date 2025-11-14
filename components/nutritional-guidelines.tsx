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
  
  // Split guidelines into sentences
  const sentences = guidelines.split(/\n+/).filter(s => s.trim());
  
  // Show first 3-4 sentences by default
  const previewSentences = sentences.slice(0, 4);
  const remainingSentences = sentences.slice(4);
  
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
          <Info className="w-5 h-5" />
          Wytyczne żywieniowe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-blue-800 space-y-2">
          {previewSentences.map((sentence, index) => (
            <p key={index}>{sentence}</p>
          ))}
          
          {isExpanded && remainingSentences.map((sentence, index) => (
            <p key={`expanded-${index}`}>{sentence}</p>
          ))}
          
          {remainingSentences.length > 0 && (
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
