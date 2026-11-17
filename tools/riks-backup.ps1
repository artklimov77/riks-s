# Рикс+С — автобэкап CRM на сервер в офисе (Windows).
# Каждый запуск забирает полную копию базы (лиды, сделки, клиенты, прайс, настройки) в JSON + CSV сделок.
#   hourly\   — копии за последние 48 часов
#   daily\    — одна копия в день, хранится 30 дней
#   monthly\  — ЭТАЛОННАЯ копия на каждый месяц, никогда не перезаписывается и не удаляется
#
# Установка (один раз):
#   1. Положить этот файл, например, в D:\RiksBackup\riks-backup.ps1
#   2. Рядом создать файл pass.txt с паролем от админки (только он, одной строкой)
#   3. Планировщик заданий → Создать задачу → «Ежечасно» →
#      Действие: powershell.exe -ExecutionPolicy Bypass -File "D:\RiksBackup\riks-backup.ps1"

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Url  = 'https://www.riks-s.ru/api/db'
$Pass = (Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'pass.txt')).Trim()

foreach ($d in 'hourly','daily','monthly','logs') { New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null }
$log = Join-Path $Root ('logs\backup-' + (Get-Date -Format 'yyyy-MM') + '.log')

try {
  $body = @{ pass = $Pass; op = 'backup' } | ConvertTo-Json -Compress
  $resp = Invoke-WebRequest -Uri $Url -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json; charset=utf-8' -UseBasicParsing -TimeoutSec 120
  $text = [Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
  $json = $text | ConvertFrom-Json
  if (-not $json.ok) { throw "Сервер ответил ошибкой: $text" }

  $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
  $data  = $json.backup | ConvertTo-Json -Depth 20
  $utf8  = New-Object System.Text.UTF8Encoding($true)

  $hourly = Join-Path $Root "hourly\riks-$stamp.json"
  [IO.File]::WriteAllText($hourly, $data, $utf8)

  $daily = Join-Path $Root ('daily\riks-' + (Get-Date -Format 'yyyy-MM-dd') + '.json')
  [IO.File]::WriteAllText($daily, $data, $utf8)   # в течение дня обновляется, итог — последняя копия дня

  $monthly = Join-Path $Root ('monthly\riks-ETALON-' + (Get-Date -Format 'yyyy-MM') + '.json')
  if (-not (Test-Path $monthly)) { [IO.File]::WriteAllText($monthly, $data, $utf8) }   # эталон: первая копия месяца

  # CSV сделок для Excel
  $rows = foreach ($d in $json.backup.orders) {
    $sum = 0; foreach ($i in $d.items) { $sum += [double]$i.qty * [double]$i.price }
    [pscustomobject]@{ Клиент=$d.client; Телефон=$d.phone; Стадия=$d.status; Направление=$d.kind; Источник=$d.source; Сумма=$sum; Предоплата=$d.prepaid; УПД=$d.updDate; Создана=$d.ts }
  }
  $rows | Export-Csv -Path (Join-Path $Root 'daily\deals-latest.csv') -NoTypeInformation -Encoding UTF8 -Delimiter ';'

  # чистка: hourly старше 48 ч, daily старше 30 дней (monthly не трогаем никогда)
  Get-ChildItem (Join-Path $Root 'hourly') -Filter *.json | Where-Object { $_.LastWriteTime -lt (Get-Date).AddHours(-48) } | Remove-Item -Force
  Get-ChildItem (Join-Path $Root 'daily') -Filter 'riks-*.json' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force

  Add-Content -Path $log -Value ((Get-Date -Format s) + " OK  leads=$($json.backup.leads.Count) deals=$($json.backup.orders.Count) clients=$($json.backup.clients.Count)")
}
catch {
  Add-Content -Path $log -Value ((Get-Date -Format s) + " ERR $($_.Exception.Message)")
  exit 1
}
