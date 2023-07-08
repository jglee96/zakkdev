import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Button,
} from '@zakkdev/ui';
import {
  SunIcon,
  MoonIcon,
  DesktopIcon,
  Half2Icon,
} from '@radix-ui/react-icons';

export function DarkModeSelector() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="icon"
          aria-label="button for hange the color one of scheme system, light, dark"
          asChild
        >
          <div>
            <Half2Icon className="h-4 w-4" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="menu for hange the color one of scheme system, light, dark">
        <DropdownMenuItem key="system" className="gap-2">
          <DesktopIcon />
          System
        </DropdownMenuItem>
        <DropdownMenuItem key="light" className="gap-2">
          <SunIcon />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem key="dark" className="gap-2">
          <MoonIcon />
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default DarkModeSelector;
