import { Dropdown } from '@nextui-org/react';
import { useTheme } from 'next-themes';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import { useEffect, useState } from 'react';

export function DarkModeSelector() {
  const [selectedKey, setSelectedKey] = useState<Set<string>>(
    new Set(['system'])
  );
  const { setTheme, theme } = useTheme();

  useEffect(() => setSelectedKey(new Set([theme ?? 'system'])), [theme]);
  console.log(selectedKey);

  return (
    <Dropdown>
      <Dropdown.Button
        color="gradient"
        icon={<Brightness4Icon />}
        aria-label="button for hange the color one of scheme system, light, dark"
      />
      <Dropdown.Menu
        aria-label="menu for hange the color one of scheme system, light, dark"
        css={{ $$dropdownMenuMinWidth: '160px' }}
        // variant="light"
        variant="flat"
        color="secondary"
        disallowEmptySelection
        selectionMode="single"
        selectedKeys={selectedKey}
        onSelectionChange={(keys) => setTheme(Array.from(keys)[0].toString())}
      >
        <Dropdown.Item key="system" icon={<Brightness4Icon />}>
          System
        </Dropdown.Item>
        <Dropdown.Item key="light" icon={<LightModeOutlinedIcon />}>
          Light
        </Dropdown.Item>
        <Dropdown.Item key="dark" icon={<DarkModeOutlinedIcon />}>
          Dark
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default DarkModeSelector;
