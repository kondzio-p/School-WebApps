import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

interface Zwierze {
  nazwa:string
  gatunek:string
  kontynent:string
  zdjecie:string
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule, CommonModule, HttpClientModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('cwiczenie3Json');

  zwierzeta: Zwierze[] = [];
  wybraneZwierze: Zwierze | null = null;

  constructor(private http: HttpClient) {};

  ngOnInit(): void {
    this.http.get<Zwierze[]>('assets/dane.json').subscribe({
      next: (data) => this.zwierzeta = data,
      error: () => alert('Błąd wczytywania danych z pliku JSON!')
    });
  }

  wypisz(zdjecie: string): string {
    return 'assets/obrazki/' + zdjecie;
  }

  wybierzZwierze(zwierze: Zwierze): void {
    this.wybraneZwierze = zwierze;
  }
}
