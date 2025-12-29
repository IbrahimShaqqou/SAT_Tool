/**
 * Table component with sorting support
 * Supports both declarative (children) and data-driven (columns/data) patterns
 */
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const Table = ({ children, columns, data, emptyMessage = 'No data', className = '' }) => {
  // If columns and data are provided, render a data-driven table
  if (columns && data) {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={row.id || rowIndex} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // Otherwise, render children (declarative pattern)
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        {children}
      </table>
    </div>
  );
};

const TableHeader = ({ children }) => (
  <thead className="bg-gray-50">
    {children}
  </thead>
);

const TableBody = ({ children }) => (
  <tbody className="bg-white divide-y divide-gray-200">
    {children}
  </tbody>
);

const TableRow = ({ children, onClick, className = '' }) => (
  <tr
    className={`${onClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </tr>
);

const TableHead = ({
  children,
  sortable = false,
  sorted = null, // 'asc', 'desc', or null
  onSort,
  className = '',
}) => {
  const SortIcon = sorted === 'asc'
    ? ChevronUp
    : sorted === 'desc'
    ? ChevronDown
    : ChevronsUpDown;

  return (
    <th
      scope="col"
      className={`
        px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
        ${sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''}
        ${className}
      `}
      onClick={sortable ? onSort : undefined}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && (
          <SortIcon className={`h-4 w-4 ${sorted ? 'text-gray-900' : 'text-gray-400'}`} />
        )}
      </div>
    </th>
  );
};

const TableCell = ({ children, className = '' }) => (
  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`}>
    {children}
  </td>
);

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Head = TableHead;
Table.Cell = TableCell;

export default Table;
