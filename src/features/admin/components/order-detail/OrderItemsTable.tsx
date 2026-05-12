import type { AdminOrderItem } from "../../api";
import { getItemTitle, humanizeText } from "../../utils";

interface OrderItemsTableProps {
  items: AdminOrderItem[];
}

export function OrderItemsTable({ items }: OrderItemsTableProps) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-order-items-grid-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Type</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id ?? `item-${idx}`}>
              <td>{getItemTitle(item)}</td>
              <td>{humanizeText(item.item_type)}</td>
              <td>{item.quantity ?? 1}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
