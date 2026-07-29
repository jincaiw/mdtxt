param(
  [Parameter(Mandatory = $true)]
  [int]$TargetProcessId,

  [Parameter(Mandatory = $true)]
  [int]$Index,

  [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class MdtxtNativePointer {
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int command);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int x, int y);

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);

  public const uint LeftDown = 0x0002;
  public const uint LeftUp = 0x0004;
  public const int Restore = 9;
}
'@

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
while ([DateTime]::UtcNow -lt $deadline) {
  $process = Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue
  if ($null -ne $process -and $process.MainWindowHandle -ne [IntPtr]::Zero) {
    try {
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
      $condition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::TabItem
      )
      $tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
      if ($tabs.Count -gt $Index) {
        $tab = $tabs.Item($Index)
        # WebView2 exposes the ARIA tab to UI Automation but does not reliably
        # bridge SelectionItem or keyboard focus activation back to the DOM.
        # Use the accessible element's native screen rectangle for a real
        # pointer activation of the same standard click path users exercise.
        $rect = $tab.Current.BoundingRectangle
        $x = [int]($rect.Left + ($rect.Width / 2))
        $y = [int]($rect.Top + ($rect.Height / 2))
        [void][MdtxtNativePointer]::ShowWindow($process.MainWindowHandle, [MdtxtNativePointer]::Restore)
        if (-not [MdtxtNativePointer]::SetForegroundWindow($process.MainWindowHandle)) {
          throw "Could not foreground mdtxt before selecting tab index $Index."
        }
        Start-Sleep -Milliseconds 250
        if (-not [MdtxtNativePointer]::SetCursorPos($x, $y)) {
          throw "Could not move the native pointer to tab index $Index."
        }
        [MdtxtNativePointer]::mouse_event([MdtxtNativePointer]::LeftDown, 0, 0, 0, [UIntPtr]::Zero)
        [MdtxtNativePointer]::mouse_event([MdtxtNativePointer]::LeftUp, 0, 0, 0, [UIntPtr]::Zero)
        Write-Output "MDTXT_UIA_SELECT_TAB index=$Index count=$($tabs.Count) name=$($tab.Current.Name) method=native-pointer x=$x y=$y bounds=$($rect.Left),$($rect.Top),$($rect.Width),$($rect.Height)"
        exit 0
      }
    } catch {
      # React/WebView2 may replace the accessibility node while recovery mounts.
    }
  }
  Start-Sleep -Milliseconds 200
}

throw "Timed out waiting to select tab index $Index."
