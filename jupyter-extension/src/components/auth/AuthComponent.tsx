import React, { useState } from 'react';
import WalletButton from '../auth/WalletButton';


interface AuthComponentProps {
  title?: string;
}

export const AuthComponent: React.FC<AuthComponentProps> = ({ 
  title = 'User Authentication' 
}) => {
 
  const [userAccount, setUserAccount] = useState<string | null>(null);

  return (
    <div style={{ 
      padding: '20px',
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      minHeight: '400px'
    }}>
      <h1 style={{ 
        fontSize: '2em',
        margin: '20px 0',
        color: 'var(--jp-ui-font-color1)',
        textAlign: 'center'
      }}>
      {title}
      </h1>
       {userAccount && <h1>User info</h1>}
        <WalletButton setUserAccount={setUserAccount} />
     
    </div>
  );
};

export default AuthComponent;
