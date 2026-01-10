import {
  CardData,
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoice,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { createClient } from './supabase/client';

const supabase = createClient();

export async function fetchRevenue(): Promise<Revenue[]> {
  // Artificially delay a response for demo purposes.
  // Don't do this in production :)

  const { data, error } = await supabase.from("revenue").select("*");

  if (error) {
    console.error('Database Error:', error);
    return [];
  }

  return data || [];
}

export async function fetchLatestInvoices(): Promise<LatestInvoice[]> {
    const { data, error } = await supabase
      .from("invoices_with_customers")
      .select('*')
      .order("date", { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('Database Error:', error);
      return [];
    }

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount), // форматируем валюту
    }));
    
    return latestInvoices;
}

export async function fetchCardData(): Promise<CardData> {
  // You can probably combine these into a single SQL query
  // However, we are intentionally splitting them to demonstrate
  // how to initialize multiple queries in parallel with JS.
  const invoiceCountPromise = supabase.from("invoices").select("count");
  const customerCountPromise = supabase.from("customers").select("*", {
    count: "exact", // 'exact', 'planned', 'estimated'
    head: true, // не получаем данные, только метаданные
  });
  const invoiceStatusPromise = supabase
    .from("invoice_status_totals")
    .select("*");

  const [
      { data: invoiceData, error: invoiceError },
      { count: customerCount, error: customerError },
      { data: statusData, error: statusError }
    ] = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    // Проверяем ошибки
    const errors = [invoiceError, customerError, statusError].filter(Boolean);
    if (errors.length > 0) {
      console.error('Unexpected error in fetchCardData:', errors);
    }

  const numberOfInvoices = Number(invoiceData?.[0]?.count ?? 0);
  const numberOfCustomers = Number(customerCount ?? 0);
  const totalPaidInvoices = formatCurrency(statusData?.[0]?.paid ?? 0);
  const totalPendingInvoices = formatCurrency(statusData?.[0]?.pending ?? 0);

  return {
    numberOfCustomers,
    numberOfInvoices,
    totalPaidInvoices,
    totalPendingInvoices,
  };
}

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
  ITEMS_PER_PAGE: number = 6
): Promise<InvoicesTable[]> {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  const { data: invoices, error } = await supabase
    .from("invoices_with_customers")
    .select("*")
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .order("date", { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1);

  if (error) {
    console.error("Database Error:", error);
    return [];
  }

  return invoices;
}

export async function fetchInvoicesPages(query: string, ITEMS_PER_PAGE: number = 6) {
  const { data: invoices, error } = await supabase
    .from("invoices_with_customers")
    .select('id')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)

  if (error) {
    console.error("Database Error:", error);
    return 0;
  }

    const totalPages = Math.ceil(Number(invoices?.length || 0) / ITEMS_PER_PAGE);
    return totalPages;
}

// export async function fetchInvoiceById(id: string) {
//   try {
//     const data = await sql<InvoiceForm[]>`
//       SELECT
//         invoices.id,
//         invoices.customer_id,
//         invoices.amount,
//         invoices.status
//       FROM invoices
//       WHERE invoices.id = ${id};
//     `;

//     const invoice = data.map((invoice) => ({
//       ...invoice,
//       // Convert amount from cents to dollars
//       amount: invoice.amount / 100,
//     }));

//     return invoice[0];
//   } catch (error) {
//     console.error('Database Error:', error);
//     throw new Error('Failed to fetch invoice.');
//   }
// }

// export async function fetchCustomers() {
//   try {
//     const customers = await sql<CustomerField[]>`
//       SELECT
//         id,
//         name
//       FROM customers
//       ORDER BY name ASC
//     `;

//     return customers;
//   } catch (err) {
//     console.error('Database Error:', err);
//     throw new Error('Failed to fetch all customers.');
//   }
// }

// export async function fetchFilteredCustomers(query: string) {
//   try {
//     const data = await sql<CustomersTableType[]>`
// 		SELECT
// 		  customers.id,
// 		  customers.name,
// 		  customers.email,
// 		  customers.image_url,
// 		  COUNT(invoices.id) AS total_invoices,
// 		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
// 		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
// 		FROM customers
// 		LEFT JOIN invoices ON customers.id = invoices.customer_id
// 		WHERE
// 		  customers.name ILIKE ${`%${query}%`} OR
//         customers.email ILIKE ${`%${query}%`}
// 		GROUP BY customers.id, customers.name, customers.email, customers.image_url
// 		ORDER BY customers.name ASC
// 	  `;

//     const customers = data.map((customer) => ({
//       ...customer,
//       total_pending: formatCurrency(customer.total_pending),
//       total_paid: formatCurrency(customer.total_paid),
//     }));

//     return customers;
//   } catch (err) {
//     console.error('Database Error:', err);
//     throw new Error('Failed to fetch customer table.');
//   }
// }
