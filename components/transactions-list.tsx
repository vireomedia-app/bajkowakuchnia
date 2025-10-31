
'use client'

import { Transaction } from '@/lib/types'
import { FileText, TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'
import { EditTransactionButton } from './edit-transaction-button'
import { DeleteTransactionButton } from './delete-transaction-button'

interface TransactionsListProps {
  transactions: Transaction[]
  productId: string
}

export function TransactionsList({ transactions }: TransactionsListProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-100 p-12 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Brak transakcji</h3>
        <p className="text-gray-600 mb-4">Nie znaleziono żadnych transakcji dla tego produktu.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 flex items-center space-x-2">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Historia Transakcji</span>
          <span className="text-xs sm:text-sm text-gray-500 ml-2">({transactions.length})</span>
        </h3>
      </div>

      {/* Desktop View - Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dokument
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Przychód
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rozchód
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Saldo
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Akcje
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((transaction, index) => (
              <motion.tr 
                key={transaction?.id || `transaction-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      {transaction?.date 
                        ? new Date(transaction.date).toLocaleDateString('pl-PL')
                        : 'Nieznana data'
                      }
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">
                    {transaction?.document || 'Brak numeru'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {transaction?.type === 'INCOME' ? (
                    <div className="flex items-center justify-end space-x-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">
                        +{(transaction?.quantity || 0).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {transaction?.type === 'OUTCOME' ? (
                    <div className="flex items-center justify-end space-x-1">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium text-red-600">
                        -{(transaction?.quantity || 0).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm font-bold text-gray-900">
                    {(transaction?.balance || 0).toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <EditTransactionButton transaction={transaction} />
                    <DeleteTransactionButton transactionId={transaction?.id || ''} />
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Mobile View - Cards */}
      <div className="md:hidden divide-y divide-gray-200">
        {transactions.map((transaction, index) => (
          <motion.div
            key={transaction?.id || `transaction-mobile-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 hover:bg-gray-50 transition-colors"
          >
            {/* Header with Date and Actions */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900">
                  {transaction?.date 
                    ? new Date(transaction.date).toLocaleDateString('pl-PL')
                    : 'Nieznana data'
                  }
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <EditTransactionButton transaction={transaction} />
                <DeleteTransactionButton transactionId={transaction?.id || ''} />
              </div>
            </div>
            
            {/* Document */}
            <div className="mb-3">
              <span className="text-xs text-gray-500">Dokument:</span>
              <span className="text-sm text-gray-900 ml-2">
                {transaction?.document || 'Brak numeru'}
              </span>
            </div>
            
            {/* Transaction Details */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500 mb-1">Przychód</div>
                {transaction?.type === 'INCOME' ? (
                  <div className="flex items-center justify-center space-x-1">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <span className="text-sm font-medium text-green-600">
                      +{(transaction?.quantity || 0).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500 mb-1">Rozchód</div>
                {transaction?.type === 'OUTCOME' ? (
                  <div className="flex items-center justify-center space-x-1">
                    <TrendingDown className="w-3 h-3 text-red-600" />
                    <span className="text-sm font-medium text-red-600">
                      -{(transaction?.quantity || 0).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              
              <div className="text-center p-2 bg-blue-50 rounded">
                <div className="text-xs text-gray-500 mb-1">Saldo</div>
                <span className="text-sm font-bold text-gray-900">
                  {(transaction?.balance || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Summary */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            Łączna liczba transakcji: <strong>{transactions.length}</strong>
          </span>
          <span className="text-gray-600">
            Ostatnie saldo: <strong className="text-gray-900">
              {transactions.length > 0 
                ? (transactions[transactions.length - 1]?.balance || 0).toFixed(2)
                : '0.00'
              }
            </strong>
          </span>
        </div>
      </div>
    </div>
  )
}
