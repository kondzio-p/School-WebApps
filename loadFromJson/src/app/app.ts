import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

interface interfejs {
  nazwa: string;
  rok: number;
  obraz: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule, CommonModule, HttpClientModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  title = 'loadFromJson';

  Filmy: interfejs[] = [];
  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ filmy: interfejs[] }>('/assets/filmy.json').subscribe((data) => {
      this.Filmy = data.filmy;
    });
  }

  wypisz(obraz: string) {
    return 'assets/images/' + obraz;
  }
}
