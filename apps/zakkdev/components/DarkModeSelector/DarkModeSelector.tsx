import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Button,
} from '@zakkdev/ui';

export function DarkModeSelector() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button aria-label="button for hange the color one of scheme system, light, dark" />
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="menu for hange the color one of scheme system, light, dark">
        <DropdownMenuItem key="system">System</DropdownMenuItem>
        <DropdownMenuItem key="light">Light</DropdownMenuItem>
        <DropdownMenuItem key="dark">Dark</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default DarkModeSelector;
