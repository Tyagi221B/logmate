import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, MapPin, Navigation, Package, Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LocationInput } from '@/components/LocationInput'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Field, FieldTitle, FieldDescription, FieldError, FieldGroup } from '@/components/ui/field'
import type { TripRequest } from '@/types/trip'

const schema = z.object({
  current_location: z.string().min(3, 'Enter at least 3 characters'),
  pickup_location: z.string().min(3, 'Enter at least 3 characters'),
  dropoff_location: z.string().min(3, 'Enter at least 3 characters'),
  current_cycle_hours: z.coerce
    .number({ error: 'Enter a number' })
    .min(0, 'Cannot be negative')
    .max(70, 'Maximum is 70 hours'),
}).refine(
  (d) => d.pickup_location.trim() !== d.dropoff_location.trim(),
  { message: 'Pickup and dropoff cannot be the same location', path: ['dropoff_location'] },
)

// z.coerce.number() has input type `unknown` (accepts any raw value) but output type `number`.
// We split the types so react-hook-form gets the raw input shape and the submit handler
// receives the fully-parsed output shape.
type FormInput  = z.input<typeof schema>   // current_cycle_hours: unknown (raw field value)
type FormOutput = z.output<typeof schema>  // current_cycle_hours: number  (after coercion)

interface Props {
  onSubmit: (req: TripRequest) => void
  loading: boolean
  defaultValues?: Partial<TripRequest>
}

export default function TripForm({ onSubmit, loading, defaultValues }: Props) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { current_location: '', pickup_location: '', dropoff_location: '', ...defaultValues },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4">
          <div className="mb-2 flex items-center gap-2">
            <Navigation className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">ELD Trip Planner</CardTitle>
          </div>
          <CardDescription>
            Enter your trip details to generate a compliant HOS schedule and driver log sheets.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup className="gap-4">

              <Field data-invalid={!!errors.current_location}>
                <FieldTitle>
                  <MapPin className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Current Location
                </FieldTitle>
                <FieldDescription>Where the truck is right now</FieldDescription>
                <LocationInput
                  name="current_location"
                  control={control}
                  placeholder="e.g. Chicago, IL"
                  disabled={loading}
                />
                <FieldError errors={[errors.current_location]} />
              </Field>

              <Field data-invalid={!!errors.pickup_location}>
                <FieldTitle>
                  <Package className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Pickup Location
                </FieldTitle>
                <FieldDescription>Where you'll pick up the load</FieldDescription>
                <LocationInput
                  name="pickup_location"
                  control={control}
                  placeholder="e.g. St. Louis, MO"
                  disabled={loading}
                />
                <FieldError errors={[errors.pickup_location]} />
              </Field>

              <Field data-invalid={!!errors.dropoff_location}>
                <FieldTitle>
                  <MapPin className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Dropoff Location
                </FieldTitle>
                <FieldDescription>Where you'll deliver the load</FieldDescription>
                <LocationInput
                  name="dropoff_location"
                  control={control}
                  placeholder="e.g. Dallas, TX"
                  disabled={loading}
                />
                <FieldError errors={[errors.dropoff_location]} />
              </Field>

              <Field data-invalid={!!errors.current_cycle_hours}>
                <FieldTitle>
                  <Clock className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  Current Cycle Hours Used
                </FieldTitle>
                <FieldDescription>Hours used in the last 8 days (0 – 70)</FieldDescription>
                <Input
                  {...register('current_cycle_hours')}
                  type="number"
                  min={0}
                  max={70}
                  step={0.5}
                  placeholder="e.g. 24.5"
                  disabled={loading}
                  aria-invalid={!!errors.current_cycle_hours}
                />
                <FieldError errors={[errors.current_cycle_hours]} />
              </Field>

              <Button type="submit" className="mt-2 w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Planning your trip…
                  </>
                ) : (
                  'Plan Trip'
                )}
              </Button>

            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
