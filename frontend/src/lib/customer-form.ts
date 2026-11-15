import { useState } from "react";
import type { CheckoutCustomer } from "./types";

/** State and rules of the delivery-details form (see components/customer-fields). */

export const EMPTY_CUSTOMER: CheckoutCustomer = {
  firstName: "",
  lastName: "",
  phone: "",
  wilaya: "",
  address: "",
};

type Errors = Partial<Record<keyof CheckoutCustomer, string>>;

/** Same rule as the API: 0555123456, +213 555 12 34 56, 00213… */
const DZ_PHONE = /^(?:(?:\+|00)213|0)[1-9]\d{7,9}$/;

export function useCustomerForm(initial?: Partial<CheckoutCustomer>) {
  const [form, setForm] = useState<CheckoutCustomer>({ ...EMPTY_CUSTOMER, ...initial });
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof CheckoutCustomer>(key: K, value: CheckoutCustomer[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validate(): boolean {
    const e: Errors = {};
    if (!form.firstName.trim()) e.firstName = "الاسم مطلوب";
    if (!form.lastName.trim()) e.lastName = "اللقب مطلوب";
    if (!DZ_PHONE.test(form.phone.replace(/[\s.\-()]/g, ""))) e.phone = "اكتب رقم هاتف جزائري صحيح، مثل \u20660555 12 34 56\u2069";
    if (!form.wilaya) e.wilaya = "اختر الولاية";
    if (form.address.trim().length < 10) e.address = "اكتب العنوان كاملًا (10 أحرف على الأقل)";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /** Trimmed values, ready to send. */
  const values = (): CheckoutCustomer => ({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone.trim(),
    wilaya: form.wilaya,
    address: form.address.trim(),
  });

  return { form, setForm, errors, set, validate, values };
}

export type CustomerForm = ReturnType<typeof useCustomerForm>;
