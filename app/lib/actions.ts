"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "./supabase/client";

const FormSchema = z.object({
	id: z.string(),
	customerId: z.string({
		invalid_type_error: 'Please select a customer.',
	}),
	amount: z.coerce.number()
		.gt(0, {message: 'Please Enter an amount greater than $0.'}),
	status: z.enum(["pending", "paid"], {
		invalid_type_error: 'Please select an invoice status',
	}),
	date: z.string(),
});

const supabase = createClient();

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
	errors?: {
		customerId?: string[];
		amount?: string[];
		status?: string[];
	};
	message?: string | null;
}

export async function createInvoice(prevState: State, formData: FormData) {
	const validatedFields = CreateInvoice.safeParse({
		customerId: formData.get("customerId"),
		amount: formData.get("amount"),
		status: formData.get("status"),
	});

	if (!validatedFields.success) {
		return {
			errors: validatedFields.error.flatten().fieldErrors,
			message: 'Missing Fields. Failed to create Invoice.'
		}
	}

	// Prepare data for insertion into the database
  	const { customerId, amount, status } = validatedFields.data;
	const amountInCents = amount * 100;
	const date = new Date().toISOString().split("T")[0];

	try {
		await supabase.from("invoices").insert([
			{
				customer_id: customerId,
				amount: amountInCents,
				status: status,
				date: date,
			},
		]);
	} catch (error) {
		console.error(error);
		return {
			message: "Database Error: Failed to Create Invoice",
		};
	}

	revalidatePath("/dashboard/invoices");
	redirect("/dashboard/invoices");
}

export async function updateInvoice(id: string, formData: FormData) {
	const { customerId, amount, status } = UpdateInvoice.parse({
		customerId: formData.get("customerId"),
		amount: formData.get("amount"),
		status: formData.get("status"),
	});

	const amountInCents = amount * 100;

	try {
		await supabase
			.from("invoices")
			.update([
				{
					customer_id: customerId,
					amount: amountInCents,
					status: status,
				},
			])
			.eq("id", id);
	} catch (error) {
		console.error(error);
		throw new Error("Failed to Update Invoice");
	}

	revalidatePath("/dashboard/invoices");
	redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
	try {
		await supabase.from("invoices").delete().eq("id", id);
	} catch (error) {
		console.error(error);
		throw new Error("Database Error: Failed to Delete Invoice");
	}

	revalidatePath("/dashboard/invoices");
}
