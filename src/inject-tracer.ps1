Get-Process -Name Runner.Worker
$process=Get-Process -Name Runner.Worker
$id=$process.Id
bin\tracer.exe --inject=$id
