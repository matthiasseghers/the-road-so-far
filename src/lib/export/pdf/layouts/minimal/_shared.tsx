// Minimal layout — internal PageWrapper.
import { Page } from '@react-pdf/renderer';
import { M } from './colours';

interface PageWrapperProps {
  children:       React.ReactNode;
  paddingTop?:    string;
  paddingBottom?: string;
}

export function PageWrapper({ children, paddingTop = '20mm', paddingBottom = '20mm' }: PageWrapperProps): JSX.Element {
  return (
    <Page
      size="A4"
      style={{ paddingHorizontal: '20mm', paddingTop, paddingBottom, fontFamily: 'Helvetica', backgroundColor: M.background }}
    >
      {children}
    </Page>
  );
}
