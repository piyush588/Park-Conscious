#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int subtract(int a, int b) {
    return a - b;
}

int multiply(int a, int b) {
    return a * b;
}

int main() {
    int (*operations[3])(int,int) = {add , subtract, multiply};

    int a = 3, b = 4;

    printf("Addition: %d\n", operations[0](a,b));
    return 0;
}