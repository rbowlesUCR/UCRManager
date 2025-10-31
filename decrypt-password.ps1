# Load required assembly
Add-Type -AssemblyName System.Security

# Read the renewal JSON file
$renewalFile = "C:\ProgramData\win-acme\acme-v02.api.letsencrypt.org\oLQrJdGbVUCposv7bnm56Q.renewal.json"
$renewal = Get-Content $renewalFile | ConvertFrom-Json

# Get the encrypted password
$encryptedPassword = $renewal.PfxPasswordProtected

if ($encryptedPassword -and $encryptedPassword.StartsWith("enc-")) {
    # Remove the "enc-" prefix
    $encryptedData = $encryptedPassword.Substring(4)

    try {
        # Decrypt using DPAPI
        $bytes = [Convert]::FromBase64String($encryptedData)
        $decryptedBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
            $bytes,
            $null,
            [System.Security.Cryptography.DataProtectionScope]::CurrentUser
        )
        $password = [System.Text.Encoding]::Unicode.GetString($decryptedBytes)
        Write-Output "Decrypted password: $password"
    } catch {
        Write-Output "ERROR: Failed to decrypt password: $_"
    }
} else {
    Write-Output "No encrypted password found or invalid format"
}
