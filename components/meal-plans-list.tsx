
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, GripVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

interface MealPlan {
  id: string;
  name: string;
  description: string | null;
  season: string | null;
  days: any[];
}

interface SortableMealPlanProps {
  plan: MealPlan;
  onDuplicate: (id: string) => void;
}

function SortableMealPlan({ plan, onDuplicate }: SortableMealPlanProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plan.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDuplicateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDuplicate(plan.id);
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Przeciągnij aby zmienić kolejność"
            >
              <GripVertical className="w-5 h-5" />
            </button>

            {/* Title - clickable link */}
            <Link href={`/menu/meal-plans/${plan.id}`} className="flex-1">
              <CardTitle className="text-gray-900 hover:text-green-600 transition-colors">
                {plan.name}
              </CardTitle>
            </Link>

            {/* Duplicate Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicateClick}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              Duplikuj
            </Button>
          </div>
          {plan.description && (
            <CardDescription className="ml-8">{plan.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 ml-8">
            {plan.season && (
              <span>
                Sezon:{' '}
                {plan.season === 'SPRING'
                  ? 'Wiosna'
                  : plan.season === 'SUMMER'
                  ? 'Lato'
                  : plan.season === 'AUTUMN'
                  ? 'Jesień'
                  : 'Zima'}
              </span>
            )}
            <span>{plan.days?.length || 0} dni</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MealPlansList({ initialPlans }: { initialPlans: MealPlan[] }) {
  const [plans, setPlans] = useState<MealPlan[]>(initialPlans);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = plans.findIndex((p) => p.id === active.id);
      const newIndex = plans.findIndex((p) => p.id === over.id);

      const newPlans = arrayMove(plans, oldIndex, newIndex);
      setPlans(newPlans);

      // Save new order to backend
      try {
        const orderedIds = newPlans.map((p) => p.id);
        const response = await fetch('/api/meal-plans/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds }),
        });

        if (!response.ok) {
          throw new Error('Failed to save order');
        }

        toast.success('Kolejność zapisana');
      } catch (error) {
        console.error('Error saving order:', error);
        toast.error('Błąd podczas zapisywania kolejności');
        // Revert on error
        setPlans(initialPlans);
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const response = await fetch(`/api/meal-plans/${id}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate');
      }

      const duplicatedPlan = await response.json();
      toast.success('Jadłospis zduplikowany');
      
      // Refresh the page to show the new plan
      router.refresh();
    } catch (error) {
      console.error('Error duplicating meal plan:', error);
      toast.error('Błąd podczas duplikowania jadłospisu');
    }
  };

  if (plans.length === 0) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h3 className="text-xl font-semibold text-gray-900">Istniejące jadłospisy</h3>
      <div className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={plans} strategy={verticalListSortingStrategy}>
            {plans.map((plan) => (
              <SortableMealPlan key={plan.id} plan={plan} onDuplicate={handleDuplicate} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
