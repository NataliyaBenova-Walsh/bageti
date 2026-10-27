import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { ApiError, getJson, postJson } from '../api'
import { MAX_QUANTITY, cartTotal, useCart } from '../cart'
import { formatDay, formatPrice, formatTime } from '../format'
import type { Location, OrderConfirmation, PickupDay } from '../types'

// Same rules as the server checks, so most mistakes are caught before sending
const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.string().trim().pipe(z.email('Please enter a valid email address')),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,20}$/, 'Please enter a valid phone number'),
  note: z.string().trim().max(500, 'Please keep the note under 500 characters'),
  locationId: z.string().min(1, 'Please choose a shop'),
  pickupDate: z.string().min(1, 'Please choose a day'),
  pickupAt: z.string().min(1, 'Please choose a time'),
  payment: z.enum(['card', 'pickup']),
})

type CheckoutForm = z.infer<typeof checkoutSchema>

const inputClass =
  'w-full rounded-md border-2 border-beige bg-white px-3 py-2 focus:border-orange focus:outline-none aria-[invalid=true]:border-red aria-[invalid=true]:bg-red-50'

// A red asterisk after required labels. Screen readers skip it and hear the input's `required` instead.
function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-red">
      *
    </span>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-sm font-semibold text-red">
      <span aria-hidden="true">⚠</span>
      {message}
    </p>
  )
}

function Field({
  id,
  label,
  error,
  required = false,
  children,
}: {
  id: string
  label: string
  error?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
        {required && <RequiredMark />}
      </label>
      {children}
      <FieldError id={id} message={error} />
    </div>
  )
}

export function CheckoutPage() {
  const items = useCart((state) => state.items)
  const setQuantity = useCart((state) => state.setQuantity)
  const remove = useCart((state) => state.remove)
  const clear = useCart((state) => state.clear)
  const navigate = useNavigate()
  // Stripe sends the customer back here if they cancel the payment
  const paymentCancelled = useSearchParams()[0].get('payment') === 'cancelled'

  const [locations, setLocations] = useState<Location[]>([])
  const [days, setDays] = useState<PickupDay[]>([])
  const [cardPayments, setCardPayments] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Set once the order is accepted, so the emptied cart doesn't flash up before the confirmation page
  const [placed, setPlaced] = useState(false)
  // Set while the browser goes to Stripe's payment page
  const [redirecting, setRedirecting] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: '',
      email: '',
      phone: '',
      note: '',
      locationId: '',
      pickupDate: '',
      pickupAt: '',
      payment: 'pickup',
    },
  })
  const locationId = useWatch({ control, name: 'locationId' })
  const pickupDate = useWatch({ control, name: 'pickupDate' })
  const payment = useWatch({ control, name: 'payment' })

  useEffect(() => {
    getJson<Location[]>('/api/locations')
      .then(setLocations)
      .catch(() => setSubmitError("The shops couldn't be loaded. Please reload the page."))
    // Card payments are offered when the server has Stripe set up; then they're the default
    getJson<{ card: boolean }>('/api/payment-options')
      .then(({ card }) => {
        setCardPayments(card)
        if (card) setValue('payment', 'card')
      })
      .catch(() => {})
  }, [setValue])

  // Pickup times depend on the shop, so they're loaded when one is chosen
  async function loadSlots(id: string) {
    setDays([])
    setValue('pickupAt', '')
    const nextDays = await getJson<PickupDay[]>(`/api/locations/${id}/pickup-slots`)
    setDays(nextDays)
    setValue('pickupDate', nextDays[0]?.date ?? '')
  }

  const slots = days.find((day) => day.date === pickupDate)?.slots ?? []

  async function onSubmit(form: CheckoutForm) {
    setSubmitError(null)
    try {
      const order = await postJson<OrderConfirmation>('/api/orders', {
        customerName: form.customerName,
        email: form.email,
        phone: form.phone,
        note: form.note || undefined,
        locationId: form.locationId,
        pickupAt: form.pickupAt,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
        payment: form.payment,
      })
      // Card: pay on Stripe's page, which comes back to the confirmation page. The cart is kept
      // until then, in case the customer cancels.
      if (order.checkoutUrl) {
        setRedirecting(true)
        window.location.assign(order.checkoutUrl)
        return
      }
      setPlaced(true)
      clear()
      navigate('/order/confirmation', { replace: true, state: { order } })
    } catch (error) {
      if (error instanceof ApiError && error.body.soldOut) {
        const soldOut = items.filter((item) => error.body.soldOut!.includes(item.productId))
        soldOut.forEach((item) => remove(item.productId))
        setSubmitError(
          `Sorry, ${soldOut.map((item) => item.name).join(', ')} just sold out, so we removed it from your cart. Please check your order and send it again.`,
        )
      } else if (error instanceof ApiError && error.status === 400 && error.body.error?.includes('pickup time')) {
        setSubmitError(error.body.error)
        await loadSlots(form.locationId).catch(() => {})
      } else if (error instanceof ApiError && error.body.error) {
        setSubmitError(error.body.error)
      } else {
        setSubmitError("Your order couldn't be sent. Please check your connection and try again.")
      }
    }
  }

  if (placed) return null

  if (items.length === 0) {
    return (
      <div className="text-center">
        <h1 className="mb-4 font-hand text-4xl text-orange">Your cart is empty</h1>
        <Link to="/" className="font-semibold text-orange underline">
          Browse the menu
        </Link>
      </div>
    )
  }

  const describedBy = (field: keyof CheckoutForm) => (errors[field] ? `${field}-error` : undefined)

  return (
    <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-[1fr_1.2fr]">
      <section aria-labelledby="cart-title">
        <h1 id="cart-title" className="mb-4 font-hand text-4xl text-orange">
          Your order
        </h1>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.productId} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{item.name}</div>
                <div className="text-sm text-taupe tabular-nums">{formatPrice(item.priceCents)} each</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                  aria-label={`One less ${item.name}`}
                  className="size-8 rounded-full border-2 border-beige font-bold hover:border-orange"
                >
                  −
                </button>
                <span className="w-6 text-center tabular-nums" aria-label={`${item.quantity} ${item.name}`}>
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                  disabled={item.quantity >= MAX_QUANTITY}
                  aria-label={`One more ${item.name}`}
                  className="size-8 rounded-full border-2 border-beige font-bold hover:border-orange disabled:opacity-40"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.productId)}
                  className="ml-1 text-sm text-med-brown underline"
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between border-t-2 border-beige pt-2 text-lg font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(cartTotal(items))}</span>
        </p>
        <p className="mt-1 text-sm text-taupe">
          {cardPayments ? 'Pay now online, or when you pick up your order.' : 'You pay when you pick up your order.'}
        </p>
        <Link to="/" className="mt-4 inline-block font-semibold text-orange underline">
          Add more from the menu
        </Link>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-labelledby="details-title">
        <h2 id="details-title" className="font-hand text-3xl text-orange">
          Pickup details
        </h2>
        <p className="-mt-3 text-sm text-taupe">
          Fields marked with <span className="font-semibold text-red">*</span> are required.
        </p>

        <fieldset>
          <legend className="mb-1 font-semibold">
            Shop
            <RequiredMark />
          </legend>
          <div className="space-y-2">
            {locations.map((location) => (
              <label
                key={location.id}
                className={`flex cursor-pointer items-start gap-3 rounded-md border-2 p-3 has-checked:border-orange ${errors.locationId ? 'border-red bg-red-50' : 'border-beige bg-white'}`}
              >
                <input
                  type="radio"
                  value={location.id}
                  {...register('locationId', {
                    onChange: (event) =>
                      loadSlots(event.target.value).catch(() =>
                        setSubmitError("Pickup times couldn't be loaded. Please try again."),
                      ),
                  })}
                  required
                  aria-describedby={describedBy('locationId')}
                  className="mt-1 accent-orange"
                />
                <span>
                  <span className="block font-semibold">{location.name}</span>
                  <span className="block text-sm text-taupe">
                    {location.address} · {location.opensAt}–{location.closesAt}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <FieldError id="locationId" message={errors.locationId?.message} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pickupDate" label="Day" error={errors.pickupDate?.message} required>
            <select
              id="pickupDate"
              {...register('pickupDate', { onChange: () => setValue('pickupAt', '') })}
              disabled={days.length === 0}
              required
              aria-invalid={!!errors.pickupDate}
              aria-describedby={describedBy('pickupDate')}
              className={inputClass}
            >
              {days.length === 0 && <option value="">{locationId ? 'Loading…' : 'Choose a shop first'}</option>}
              {days.map((day) => (
                <option key={day.date} value={day.date}>
                  {formatDay(day.date, day.slots[0])}
                </option>
              ))}
            </select>
          </Field>
          <Field id="pickupAt" label="Time" error={errors.pickupAt?.message} required>
            <select
              id="pickupAt"
              {...register('pickupAt')}
              disabled={slots.length === 0}
              required
              aria-invalid={!!errors.pickupAt}
              aria-describedby={describedBy('pickupAt')}
              className={inputClass}
            >
              <option value="">{slots.length === 0 ? '—' : 'Choose a time'}</option>
              {slots.map((slot) => (
                <option key={slot} value={slot}>
                  {formatTime(slot)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="-mt-3 text-sm text-taupe">Order at least an hour ahead, up to a week in advance.</p>

        <Field id="customerName" label="Name" error={errors.customerName?.message} required>
          <input
            id="customerName"
            autoComplete="name"
            {...register('customerName')}
            required
            aria-invalid={!!errors.customerName}
            aria-describedby={describedBy('customerName')}
            className={inputClass}
          />
        </Field>
        <Field id="email" label="Email" error={errors.email?.message} required>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            required
            aria-invalid={!!errors.email}
            aria-describedby={describedBy('email')}
            className={inputClass}
          />
        </Field>
        <Field id="phone" label="Phone" error={errors.phone?.message} required>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            {...register('phone')}
            required
            aria-invalid={!!errors.phone}
            aria-describedby={describedBy('phone')}
            className={inputClass}
          />
        </Field>
        <Field id="note" label="Note (optional)" error={errors.note?.message}>
          <textarea
            id="note"
            rows={3}
            {...register('note')}
            aria-invalid={!!errors.note}
            aria-describedby={describedBy('note')}
            className={inputClass}
          />
        </Field>

        {cardPayments && (
          <fieldset>
            <legend className="mb-1 font-semibold">Payment</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['card', 'Pay now online'],
                  ['pickup', 'Pay at pickup'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-beige bg-white p-3 has-checked:border-orange"
                >
                  <input type="radio" value={value} {...register('payment')} className="accent-orange" />
                  <span className="font-semibold">{label}</span>
                </label>
              ))}
            </div>
            {payment === 'card' && (
              <p className="mt-1 text-sm text-taupe">
                You'll pay on Stripe's secure page. This is a demo in test mode: use the card number 4242 4242 4242
                4242, any future date and any CVC.
              </p>
            )}
          </fieldset>
        )}

        {paymentCancelled && !submitError && (
          <p role="status" className="rounded-md border-2 border-beige bg-white p-3">
            The payment was cancelled, and nothing was charged. Your cart is still here, so you can try again or
            choose to pay at pickup.
          </p>
        )}

        {submitError && (
          <p role="alert" className="rounded-md border-2 border-red bg-red-50 p-3 font-semibold text-red">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || redirecting}
          className="w-full rounded-full bg-orange px-6 py-3 text-lg font-semibold text-cream hover:bg-med-brown focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:opacity-60"
        >
          {redirecting
            ? 'Opening the payment page…'
            : isSubmitting
              ? 'Sending your order…'
              : payment === 'card'
                ? `Pay ${formatPrice(cartTotal(items))}`
                : `Place order · ${formatPrice(cartTotal(items))}`}
        </button>
      </form>
    </div>
  )
}
