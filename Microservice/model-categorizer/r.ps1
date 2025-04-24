        $env:GOOS = "linux"
        $env:GOARCH = "amd64"
        $env:CGO_ENABLED = "0"
        go build -o main . # Or specify the path to your main package if not in '.'
        # Optional: Unset the variables afterwards
        Remove-Item Env:\GOOS
        Remove-Item Env:\GOARCH
        Remove-Item Env:\CGO_ENABLED