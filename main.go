package main
import "fmt"
import "os"

func main() {
    path, err := os.Executable()
    if err != nil {
        fmt.Println("FAIL:", err)
    } else {
        fmt.Println("OK:", path)
    }
}
