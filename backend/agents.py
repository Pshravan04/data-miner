from crewai import Agent, Task, Crew, Process
from tools import GoogleMapsScraperTool, ApolloScraperTool
import os

class ScraperCrew:
    def __init__(self, job_id, request, jobs_store):
        self.job_id = job_id
        self.request = request
        self.jobs_store = jobs_store
        
    def log(self, message):
        self.jobs_store[self.job_id]["logs"].append(message)
        self.jobs_store[self.job_id]["progress"] = message
        print(f"[{self.job_id}] {message}")

    def run(self):
        self.log("Setting up agents for platform extraction...")
        
        # Tools
        gmaps_tool = GoogleMapsScraperTool()
        apollo_tool = ApolloScraperTool()

        # Agents
        search_agent = Agent(
            role='Data Discovery Specialist',
            goal='Identify the best search queries and targets for the requested niche and location.',
            backstory='An expert in formulating search strategies to find businesses in specific niches.',
            verbose=True,
            allow_delegation=False
        )
        
        maps_agent = Agent(
            role='Google Maps Extraction Specialist',
            goal='Extract business names, addresses, and websites using Google Maps.',
            backstory='A specialist in localized business data extraction.',
            tools=[gmaps_tool] if "Google Maps" in self.request.platforms else [],
            verbose=True,
            allow_delegation=False
        )

        apollo_agent = Agent(
            role='Apollo B2B Enrichment Specialist',
            goal='Find contact information (emails, phones) for businesses using Apollo.',
            backstory='A B2B data enrichment expert.',
            tools=[apollo_tool] if "Apollo" in self.request.platforms else [],
            verbose=True,
            allow_delegation=False
        )

        consolidator_agent = Agent(
            role='Data Consolidation Expert',
            goal='Merge all gathered data, remove duplicates, and output to a structured Excel file.',
            backstory='A data engineering specialist who ensures final datasets are clean and well-structured.',
            verbose=True,
            allow_delegation=False
        )

        # Tasks
        task1 = Task(
            description=f'Formulate a search strategy to find {self.request.niche} businesses in {self.request.location}.',
            expected_output='A list of target queries and domains.',
            agent=search_agent
        )
        
        task2 = Task(
            description=f'Extract up to {self.request.max_results} businesses from Google Maps based on the search strategy.',
            expected_output='JSON list of businesses with name, address, website.',
            agent=maps_agent
        )

        task3 = Task(
            description='Enrich the extracted businesses with contact emails and phone numbers from Apollo.',
            expected_output='JSON list of businesses with added contact info.',
            agent=apollo_agent
        )

        task4 = Task(
            description='Consolidate all data into a pandas DataFrame and save to an Excel file.',
            expected_output='The absolute file path of the generated Excel file.',
            agent=consolidator_agent
        )

        tasks_to_run = [task1]
        if "Google Maps" in self.request.platforms:
            tasks_to_run.append(task2)
        if "Apollo" in self.request.platforms:
            tasks_to_run.append(task3)
        tasks_to_run.append(task4)

        crew = Crew(
            agents=[search_agent, maps_agent, apollo_agent, consolidator_agent],
            tasks=tasks_to_run,
            process=Process.sequential
        )

        self.log("Crew execution started...")
        # NOTE: Once API keys are provided, we will call result = crew.kickoff()
        import pandas as pd
        import time
        
        # DUMMY MOCK DATA (until API keys are provided)
        self.log("Mocking crew execution due to missing API keys...")
        time.sleep(2) # Simulate work
        self.log("Search strategy formulated.")
        time.sleep(2)
        self.log("Google Maps extraction complete.")
        time.sleep(2)
        self.log("Apollo enrichment complete.")
        time.sleep(2)
        self.log("Consolidating data...")
        
        data = [
            {"Name": f"Sample {self.request.niche} 1", "Location": self.request.location, "Website": "sample1.com", "Email": "contact@sample1.com", "Phone": "+1234567890"},
            {"Name": f"Sample {self.request.niche} 2", "Location": self.request.location, "Website": "sample2.com", "Email": "info@sample2.com", "Phone": "+0987654321"}
        ]
        df = pd.DataFrame(data)
        file_name = f"results_{self.job_id}.xlsx"
        # ensure results folder exists
        results_dir = os.path.join(os.getcwd(), "results")
        os.makedirs(results_dir, exist_ok=True)
        file_path = os.path.join(results_dir, file_name)
        
        df.to_excel(file_path, index=False)
        self.log(f"Data saved to {file_path}")
        
        # Return a path that the frontend can use to download (we'll need a download endpoint in main.py)
        return file_name
