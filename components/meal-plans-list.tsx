
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, GripVertical, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  onDelete: (id: string) => void;
}

function SortableMealPlan({ plan, onDuplicate, onDelete }: SortableMealPlanProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteDialog(false);
    onDelete(plan.id);
  };

  return (
    <>
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

              {/* Delete Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteClick}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Usuń
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

    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Czy na pewno chcesz usunąć ten jadłospis?</AlertDialogTitle>
          <AlertDialogDescription>
            Ta operacja jest nieodwracalna. Jadłospis &quot;{plan.name}&quot; zostanie trwale usunięty.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            className="bg-red-600 hover:bg-red-700"
          >
            Usuń
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
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
      
      // Dodaj zduplikowany plan do listy bez odświeżania strony
      setPlans([...plans, duplicatedPlan]);
      
      toast.success('Jadłospis zduplikowany');
    } catch (error) {
      console.error('Error duplicating meal plan:', error);
      toast.error('Błąd podczas duplikowania jadłospisu');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/meal-plans/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      // Usuń plan z listy bez odświeżania strony
      setPlans(plans.filter(p => p.id !== id));
      
      toast.success('Jadłospis usunięty');
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      toast.error('Błąd podczas usuwania jadłospisu');
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
              <SortableMealPlan 
                key={plan.id} 
                plan={plan} 
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
