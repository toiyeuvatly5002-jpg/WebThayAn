param([string]$VerifyLocalClone)
$ErrorActionPreference = 'Stop'
function CheckGit([string]$reason) {
    if ($LASTEXITCODE -ne 0) { throw $reason }
}
function ReadIndex {
    $files = @{}
    $lines = git ls-files --stage
    CheckGit 'Khong doc duoc danh sach tep.'
    foreach ($line in $lines) {
        if ($line -match '^[0-7]+ ([a-f0-9]{40}) 0\t(.+)$') { $files[$Matches[2]] = $Matches[1] }
    }
    return $files
}
function Blob($files, $name) {
    if ($files.ContainsKey($name)) { return $files[$name] }
    return ('0' * 40)
}
try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Can cai Git for Windows de cap nhat.' }
    $source = 'https://github.com/toiyeuvatly5002-jpg/WebThayAn.git'
    if ($VerifyLocalClone) { $source = (Resolve-Path -LiteralPath $VerifyLocalClone).Path }
    $repo = Join-Path ([IO.Path]::GetTempPath()) ('WebThayAn-' + [guid]::NewGuid())
    $entries = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'danh-sach.json') -Raw -Encoding UTF8 | ConvertFrom-Json)
    Write-Host 'Dang lay ban moi nhat cua WebThayAn...'
    if ($VerifyLocalClone) {
        $head = git -C $source rev-parse HEAD
        CheckGit 'Khong doc duoc ban kiem tra.'
        git init --quiet --initial-branch=main $repo
        CheckGit 'Khong tao duoc kho kiem tra.'
        $objects = (Resolve-Path -LiteralPath (Join-Path $source '.git/objects')).Path.Replace('\','/')
        [IO.File]::WriteAllText((Join-Path $repo '.git/objects/info/alternates'), $objects)
        git -C $repo -c core.autocrlf=true checkout --quiet --detach $head
        CheckGit 'Khong mo duoc ban kiem tra.'
    } else {
        git -c core.autocrlf=true clone --depth 1 --single-branch --branch main -- $source $repo
        CheckGit 'Khong tai duoc kho GitHub.'
    }
    Set-Location -LiteralPath $repo
    git config --local core.autocrlf true
    CheckGit 'Khong thiet lap duoc thu muc moi.'
    $prefix = (Resolve-Path -LiteralPath $repo).Path + [IO.Path]::DirectorySeparatorChar
    $current = ReadIndex
    foreach ($entry in $entries) {
        $name = $entry.file
        $destination = [IO.Path]::GetFullPath((Join-Path $repo $name))
        if (-not $destination.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase) -or $name -notmatch '^[a-zA-Z0-9_.\-/]+$' -or $name -match '(^|/)\.(\.|git)(/|$)') { throw 'Duong dan tep khong hop le.' }
        $blob = Blob $current $name
        if ($blob -eq $entry.after) { continue }
        if ($blob -ne $entry.before) { throw "Tep $name tren GitHub da duoc sua o ban khac. Can ghep thay doi truoc khi dang." }
        if ($entry.after -match '^0+$') {
            Remove-Item -LiteralPath $destination
        } else {
            $file = Join-Path (Join-Path $PSScriptRoot 'ma-nguon') $name
            [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
            Copy-Item -LiteralPath $file -Destination $destination
        }
        git add -A -- $name
        CheckGit "Khong ghi nhan duoc $name."
    }
    $updated = ReadIndex
    foreach ($entry in $entries) {
        if ((Blob $updated $entry.file) -ne $entry.after) { throw "Noi dung tep khong khop voi ban da kiem tra: $($entry.file)." }
    }
    git diff --cached --quiet
    $difference = $LASTEXITCODE
    if ($difference -eq 0) { Write-Host 'GitHub da co ban nay.'; exit 0 }
    if ($difference -ne 1) { throw 'Khong doc duoc thay doi.' }
    git --no-pager diff --cached --stat
    CheckGit 'Khong hien duoc thay doi.'
    if ($VerifyLocalClone) { Write-Host 'Da kiem tra goi cap nhat.'; exit 0 }
    $answer = Read-Host 'Go Y roi nhan Enter de gui mot commit len GitHub (Netlify se build)'
    if ($answer -ne 'Y') { Write-Host 'Da dung truoc khi gui len GitHub.'; exit 0 }
    git -c 'user.name=Thay An' -c 'user.email=toiyeuvatly5002-jpg@users.noreply.github.com' commit -m 'Sua hinh TikZ tieng Viet va tu doc dap an tu TeX'
    CheckGit 'Chua tao duoc commit.'
    git push origin HEAD:main
    CheckGit 'GitHub chua nhan ban cap nhat. Xem thong bao phia tren.'
    Write-Host 'Da gui mot commit len GitHub. Mo Netlify, chon Activity de xem ket qua.'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($VerifyLocalClone) { Write-Host $_.InvocationInfo.PositionMessage }
    exit 1
}
