import { memo } from "react";
import type { InvoiceItem } from "./types";

export interface InvoiceTableProps {
  items: InvoiceItem[];
  total: number;
  currency?: string;
}

export const InvoiceTable = memo(function InvoiceTable({
  items,
  total,
  currency = "₹",
}: InvoiceTableProps) {
  const format = (n: number) => `${currency}${n.toLocaleString("en-IN")}`;

  return (
    <table className="pt-invoice__table" role="table" aria-label="Invoice line items">
      <thead>
        <tr>
          <th scope="col">Description</th>
          <th scope="col" style={{ textAlign: "right" }}>
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.label}>
            <td>
              <div>{item.label}</div>
              {item.description && (
                <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500, marginTop: "1px" }}>
                  {item.description}
                </div>
              )}
            </td>
            <td style={{ textAlign: "right" }}>
              <span
                style={
                  item.type === "discount"
                    ? { color: "#22c55e", fontWeight: 700 }
                    : item.type === "total"
                    ? { color: "#00c2a8", fontWeight: 900, fontSize: "14px" }
                    : undefined
                }
              >
                {item.type === "discount" ? "-" : ""}
                {format(Math.abs(item.value))}
              </span>
            </td>
          </tr>
        ))}
        <tr className="pt-invoice__total-row">
          <td>TOTAL PAID</td>
          <td style={{ textAlign: "right" }}>{format(total)}</td>
        </tr>
      </tbody>
    </table>
  );
});
