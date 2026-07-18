param(
  [Parameter(Mandatory = $true)]
  [int]$TargetProcessId,

  [Parameter(Mandatory = $true)]
  [string]$Text,

  [int]$DelayMilliseconds = 10
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class MdtxtNativeInput
{
    private const uint INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const int SW_RESTORE = 9;

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        public uint type;
        public INPUTUNION data;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct INPUTUNION
    {
        [FieldOffset(0)]
        public MOUSEINPUT mouse;

        [FieldOffset(0)]
        public KEYBDINPUT keyboard;

        [FieldOffset(0)]
        public HARDWAREINPUT hardware;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT
    {
        public int x;
        public int y;
        public uint mouseData;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort virtualKey;
        public ushort scanCode;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct HARDWAREINPUT
    {
        public uint message;
        public ushort parameterLow;
        public ushort parameterHigh;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, INPUT[] inputs, int size);

    [DllImport("user32.dll")]
    private static extern short VkKeyScanW(char character);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);

    public static void Focus(IntPtr window)
    {
        ShowWindow(window, SW_RESTORE);
        if (!SetForegroundWindow(window))
        {
            throw new InvalidOperationException("SetForegroundWindow rejected the mdtxt window.");
        }
    }

    public static void SendCharacter(char character)
    {
        short mapping = VkKeyScanW(character);
        if (mapping == -1)
        {
            throw new InvalidOperationException(
                String.Format("No virtual-key mapping for U+{0:X4}.", (int)character)
            );
        }

        ushort virtualKey = (ushort)(mapping & 0xff);
        byte modifiers = (byte)((mapping >> 8) & 0xff);
        if (modifiers != 0)
        {
            throw new InvalidOperationException(
                String.Format(
                    "The native smoke only accepts unmodified characters; '{0}' requires modifier mask {1}.",
                    character,
                    modifiers
                )
            );
        }

        var inputs = new INPUT[]
        {
            new INPUT
            {
                type = INPUT_KEYBOARD,
                data = new INPUTUNION
                {
                    keyboard = new KEYBDINPUT { virtualKey = virtualKey }
                }
            },
            new INPUT
            {
                type = INPUT_KEYBOARD,
                data = new INPUTUNION
                {
                    keyboard = new KEYBDINPUT { virtualKey = virtualKey, flags = KEYEVENTF_KEYUP }
                }
            }
        };

        uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<INPUT>());
        if (sent != inputs.Length)
        {
            throw new InvalidOperationException(
                String.Format(
                    "SendInput delivered {0} of {1} keyboard records. Win32={2}.",
                    sent,
                    inputs.Length,
                    Marshal.GetLastWin32Error()
                )
            );
        }
    }
}
'@

$process = Get-Process -Id $TargetProcessId
if ($process.MainWindowHandle -eq [IntPtr]::Zero) {
  throw "mdtxt process $TargetProcessId has no main window."
}

[MdtxtNativeInput]::Focus($process.MainWindowHandle)
Start-Sleep -Milliseconds 250

foreach ($character in $Text.ToCharArray()) {
  [MdtxtNativeInput]::SendCharacter($character)
  if ($DelayMilliseconds -gt 0) {
    Start-Sleep -Milliseconds $DelayMilliseconds
  }
}
