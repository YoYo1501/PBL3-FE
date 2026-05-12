# Fix double-corrupted Vietnamese encoding in student.js
# The file was originally UTF-8, then processed twice with wrong encoding
# Strategy: use .NET to read raw bytes, detect encoding state, fix it

$path = "d:\1.University\semester-4\semester-4\3.PBL3\BackendAPI\FrontendWeb\js\student.js"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

# Read current bytes
$bytes = [System.IO.File]::ReadAllBytes($path)
Write-Host "File size: $($bytes.Length) bytes"
Write-Host "First 10 bytes: $($bytes[0..9] | ForEach-Object { '0x{0:X2}' -f $_ })"

# The file is currently double-corrupted.
# Original: UTF-8 Vietnamese text  
# Step 1 corruption: UTF-8 bytes read as Windows-1252, saved as UTF-8
# Step 2 (my mistake): read as UTF-8, encoded as Latin-1 (wrong), saved as UTF-8
# 
# Current state: we need to figure out the actual byte pattern.
# Let's check what encoding makes sense by sampling known text.

# Read as UTF-8 (current state)
$currentText = [System.Text.Encoding]::UTF8.GetString($bytes)

# Try: current text has chars like A (195) followed by - (173)
# A = 0xC3 (195), - = 0xAD (173) in latin1 = the bytes for i-acute (í) in UTF-8
# So current mojibake chars ARE in latin-1 range and represent UTF-8 bytes

# Try Windows-1252 decode: encode current text as Win1252, get bytes, decode as UTF-8  
$win1252 = [System.Text.Encoding]::GetEncoding(1252)

try {
    $originalBytes = $win1252.GetBytes($currentText)
    $fixedText = [System.Text.Encoding]::UTF8.GetString($originalBytes)
    
    # Check if fix worked by looking for Vietnamese chars
    $hasVietnamese = $fixedText -match '[àáâãèéêìíòóôõùúăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]'
    Write-Host "After Win1252 fix - has Vietnamese: $hasVietnamese"
    Write-Host "Sample: $($fixedText.Substring(0, 150))"
    
    if ($hasVietnamese) {
        [System.IO.File]::WriteAllText($path, $fixedText, $utf8NoBom)
        Write-Host "SUCCESS: File fixed with Windows-1252 method"
    } else {
        Write-Host "Win1252 method did not produce Vietnamese - trying alternative"
        
        # Try latin-1 
        $latin1 = [System.Text.Encoding]::GetEncoding('iso-8859-1')
        $bytes2 = $latin1.GetBytes($currentText)
        $fixedText2 = [System.Text.Encoding]::UTF8.GetString($bytes2)
        $hasVietnamese2 = $fixedText2 -match '[àáâãèéêìíòóôõùúăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]'
        Write-Host "After Latin1 fix - has Vietnamese: $hasVietnamese2"
        Write-Host "Sample: $($fixedText2.Substring(0, 150))"
        
        if ($hasVietnamese2) {
            [System.IO.File]::WriteAllText($path, $fixedText2, $utf8NoBom)
            Write-Host "SUCCESS: File fixed with Latin-1 method"
        }
    }
} catch {
    Write-Host "Error during encoding fix: $_"
    
    # Fallback: try raw byte manipulation
    # Get Win1252 bytes with replacement char handling
    $encoder = $win1252.GetEncoder()
    $charArray = $currentText.ToCharArray()
    $byteBuffer = New-Object byte[] ($charArray.Length * 2)
    $byteCount = $encoder.GetBytes($charArray, 0, $charArray.Length, $byteBuffer, 0, $true)
    $trimmedBytes = $byteBuffer[0..($byteCount - 1)]
    $fixedText = [System.Text.Encoding]::UTF8.GetString($trimmedBytes)
    Write-Host "Fallback sample: $($fixedText.Substring(0, 150))"
}
