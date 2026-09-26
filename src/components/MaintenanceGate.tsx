interface MaintenanceGateProps {
  children?: React.ReactNode;
}

export const MaintenanceGate = ({ children }: MaintenanceGateProps) => {
  return <>{children}</>;
};

export default MaintenanceGate;
