import React from 'react';
import { DeviceStatus } from '../types';
interface BadgeProps {
  status: DeviceStatus;
}
export function StatusBadge({ status }: BadgeProps) {
  const config = {
    active: {
      label: 'Activo',
      classes: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    },
    expiring: {
      label: 'Por vencer',
      classes: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    },
    expired: {
      label: 'Vencido',
      classes: 'bg-rose-500/10 text-rose-500 border-rose-500/20'
    },
    deactivated: {
      label: 'Desactivado',
      classes: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
  };
  const { label, classes } = config[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      
      {label}
    </span>);

}