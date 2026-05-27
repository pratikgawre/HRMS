$users = Invoke-RestMethod -Uri 'http://localhost:8080/api/users' -Method Get
foreach ($u in $users) {
  if ($u.email -eq 'admin@gmail.com') {
    $u.lastLogin = (Get-Date).ToString('s')
  }
}
$json = $users | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri 'http://localhost:8080/api/users/bulk' -Method Post -Headers @{ 'Content-Type'='application/json' } -Body $json
(Invoke-RestMethod -Uri 'http://localhost:8080/api/users' -Method Get) | ConvertTo-Json -Depth 5
