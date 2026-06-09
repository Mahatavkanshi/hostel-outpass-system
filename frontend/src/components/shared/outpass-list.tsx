import type { Outpass } from "@/lib/types";
import { Badge, Panel, Table } from "./ui";

export function OutpassList({
  title,
  outpasses,
}: {
  title: string;
  outpasses: Outpass[];
}) {
  return (
    <Panel title={title}>
      <Table
        rows={outpasses}
        empty="No outpasses."
        render={(item) => (
          <tr key={item.id}>
            <td>{item.studentName || item.placeOfVisit}</td>
            <td>{item.dateOfLeaving}</td>
            <td>
              {item.timeOut}-{item.timeIn}
            </td>
            <td>
              <Badge>{item.status}</Badge>
            </td>
            <td>
              <Badge>{item.lateStatus}</Badge>
            </td>
          </tr>
        )}
      />
    </Panel>
  );
}

export function ActionRows({
  rows,
  action,
  onAction,
}: {
  rows: Outpass[];
  action: string;
  onAction: (id: string) => void;
}) {
  return (
    <Table
      rows={rows}
      empty="Nothing pending."
      render={(item) => (
        <tr key={item.id}>
          <td>{item.studentName}</td>
          <td>{item.placeOfVisit}</td>
          <td>
            {item.timeOut}-{item.timeIn}
          </td>
          <td>
            <button
              className="secondary-btn"
              onClick={() => onAction(item.id)}
              type="button"
            >
              {action}
            </button>
          </td>
        </tr>
      )}
    />
  );
}
